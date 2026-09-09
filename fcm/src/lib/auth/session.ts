import 'server-only'
import { randomBytes, createHash } from 'node:crypto'
import { eq, and, isNull, gt, sql } from 'drizzle-orm'
import { getAppDb } from '@/db'
import { userSession, appUser, site, userSiteMembership } from '@/db/schema'

export { SESSION_COOKIE } from './constants'

/** 유휴 만료 8시간, 절대 만료 24시간. docs/05-인증접근제어.md §3 */
const IDLE_MS = 8 * 60 * 60 * 1000
const ABSOLUTE_MS = 24 * 60 * 60 * 1000

/**
 * 쿠키에 담기는 토큰과 DB 에 저장되는 식별자를 분리한다.
 * DB 에는 토큰의 해시만 저장하므로, DB 백업이 유출되어도 그것만으로는
 * 유효한 세션을 만들 수 없다.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface SessionContext {
  sessionId: string
  userId: string
  loginId: string
  displayName: string
  /** 현재 세션의 활성 사업장. 요청 파라미터가 아니라 여기서만 온다. */
  siteId: string
  siteCode: string
  siteName: string
  jurisdiction: string
  role: 'staff' | 'site_admin'
  isSystemAdmin: boolean
}

export async function createSession(opts: {
  userId: string
  siteId: string
  role: 'staff' | 'site_admin'
  isSystemAdmin: boolean
  ipAddress?: string
  userAgent?: string
}): Promise<string> {
  const db = getAppDb()
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()

  // 계정당 활성 세션 1개. 새 로그인은 기존 세션을 밀어낸다.
  // "다른 사업장에 접근하려면 다시 로그인" 요구의 직접 구현이다.
  await db.update(userSession)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSession.userId, opts.userId), isNull(userSession.revokedAt)))

  await db.insert(userSession).values({
    id: hashToken(token),
    userId: opts.userId,
    siteId: opts.siteId,
    roleSnapshot: opts.role,
    isSystemAdmin: opts.isSystemAdmin,
    expiresAt: new Date(now + ABSOLUTE_MS),
    ipAddress: opts.ipAddress ?? null,
    userAgent: opts.userAgent ?? null,
  })
  return token
}

/**
 * 세션 검증. 매 요청마다 호출된다.
 *
 * 세션에 담긴 role 은 캐시일 뿐이며 신뢰하지 않는다. 멤버십을 다시 확인해
 * 권한 회수·역할 변경이 즉시 반영되게 한다 (E-15, E-25).
 * 문서: docs/05-인증접근제어.md §1 원칙 2
 */
export async function resolveSession(token: string | undefined): Promise<SessionContext | null> {
  if (!token) return null
  const db = getAppDb()
  const now = new Date()

  const rows = await db
    .select({
      sessionId: userSession.id,
      userId: userSession.userId,
      siteId: userSession.siteId,
      lastActiveAt: userSession.lastActiveAt,
      loginId: appUser.loginId,
      displayName: appUser.displayName,
      userActive: appUser.isActive,
      isSystemAdmin: appUser.isSystemAdmin,
      siteCode: site.code,
      siteName: site.name,
      jurisdiction: site.jurisdiction,
      siteActive: site.isActive,
    })
    .from(userSession)
    .innerJoin(appUser, eq(appUser.id, userSession.userId))
    .innerJoin(site, eq(site.id, userSession.siteId))
    .where(and(
      eq(userSession.id, hashToken(token)),
      isNull(userSession.revokedAt),
      gt(userSession.expiresAt, now),
    ))
    .limit(1)

  const s = rows[0]
  if (!s) return null
  if (!s.userActive || !s.siteActive) return null

  // 유휴 만료
  if (now.getTime() - s.lastActiveAt.getTime() > IDLE_MS) {
    await revokeSessionById(s.sessionId)
    return null
  }

  // 권한 재확인 — 세션의 role 스냅샷을 믿지 않는다.
  const mem = await db.select({ role: userSiteMembership.role })
    .from(userSiteMembership)
    .where(and(
      eq(userSiteMembership.userId, s.userId),
      eq(userSiteMembership.siteId, s.siteId),
      isNull(userSiteMembership.revokedAt),
    ))
    .limit(1)

  const role = mem[0]?.role
  if (!role) {
    // System Admin 은 멤버십 없이도 사업장을 선택할 수 있다 (docs/05 §2-5).
    if (!s.isSystemAdmin) {
      await revokeSessionById(s.sessionId)
      return null
    }
  }

  await db.update(userSession)
    .set({ lastActiveAt: now })
    .where(eq(userSession.id, s.sessionId))

  return {
    sessionId: s.sessionId,
    userId: s.userId,
    loginId: s.loginId,
    displayName: s.displayName,
    siteId: s.siteId,
    siteCode: s.siteCode,
    siteName: s.siteName,
    jurisdiction: s.jurisdiction,
    role: role ?? 'site_admin',
    isSystemAdmin: s.isSystemAdmin,
  }
}

export async function revokeSessionByToken(token: string): Promise<void> {
  await revokeSessionById(hashToken(token))
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await getAppDb().update(userSession)
    .set({ revokedAt: new Date() })
    .where(eq(userSession.id, sessionId))
}

/** 권한 회수·역할 변경·비밀번호 변경 시 호출한다. */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await getAppDb().update(userSession)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSession.userId, userId), isNull(userSession.revokedAt)))
}

export async function revokeSessionsForUserAtSite(userId: string, siteId: string): Promise<void> {
  await getAppDb().update(userSession)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(userSession.userId, userId),
      eq(userSession.siteId, siteId),
      isNull(userSession.revokedAt),
    ))
}

export async function listLoginSites() {
  // 로그인 드롭다운은 이 목록에서 생성된다. 사업장 코드를 하드코딩하지 않는다.
  return getAppDb().select({ id: site.id, code: site.code, name: site.name })
    .from(site).where(eq(site.isActive, true)).orderBy(sql`code`)
}

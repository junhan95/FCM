import { eq, and, isNull } from 'drizzle-orm'
import { getAppDb } from '@/db'
import { appUser, userSiteMembership, site } from '@/db/schema'
import { verifyPassword, hashPassword } from '@/lib/password'
import { createSession } from './session'
import { recordAudit } from '@/lib/audit'

const MAX_FAILURES = 5
const LOCK_MINUTES = 15
/** 응답 시간을 균일하게 맞추기 위한 최소 소요 시간 */
const MIN_RESPONSE_MS = 400

/**
 * 실패 사유를 구분하지 않는다.
 *
 * "비밀번호가 틀렸습니다" 와 "해당 사업장 권한이 없습니다" 를 구분해 주면,
 * 어떤 ID 가 존재하는지 그리고 그 사람이 어느 사업장 소속인지를 외부에서
 * 알아낼 수 있다. 문서: docs/05-인증접근제어.md §2-4
 */
export const LOGIN_FAILED = 'ID, 비밀번호 또는 사업장이 올바르지 않습니다.'

/** 존재하지 않는 계정에도 동일한 연산 비용을 들이기 위한 더미 해시 */
let dummyHash: string | null = null
async function getDummyHash(): Promise<string> {
  dummyHash ??= await hashPassword('dummy-password-for-timing-equalization')
  return dummyHash
}

export type LoginResult =
  | { ok: true; token: string }
  | { ok: false; message: string }

export async function login(input: {
  loginId: string
  password: string
  siteId: string
  ipAddress?: string
  userAgent?: string
}): Promise<LoginResult> {
  const started = Date.now()
  const result = await attempt(input)
  // 성공·실패·계정없음의 소요 시간 차이로 정보가 새지 않도록 하한을 맞춘다.
  const elapsed = Date.now() - started
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed))
  }
  return result
}

async function attempt(input: {
  loginId: string; password: string; siteId: string
  ipAddress?: string; userAgent?: string
}): Promise<LoginResult> {
  const db = getAppDb()
  const fail = { ok: false as const, message: LOGIN_FAILED }

  const target = (await db.select().from(site)
    .where(and(eq(site.id, input.siteId), eq(site.isActive, true))).limit(1))[0]

  const user = (await db.select().from(appUser)
    .where(eq(appUser.loginId, input.loginId.trim())).limit(1))[0]

  // 계정이 없어도 해시 검증을 수행해 소요 시간을 맞춘다.
  if (!user || !user.passwordHash) {
    await verifyPassword(await getDummyHash(), input.password)
    return fail
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) return fail
  if (!user.isActive) {
    await verifyPassword(await getDummyHash(), input.password)
    return fail
  }

  // ── 검증 1: 자격증명 ──────────────────────────────────────────
  const passwordOk = await verifyPassword(user.passwordHash, input.password)
  if (!passwordOk) {
    const count = user.failedLoginCount + 1
    await db.update(appUser).set({
      failedLoginCount: count,
      lockedUntil: count >= MAX_FAILURES
        ? new Date(Date.now() + LOCK_MINUTES * 60_000)
        : user.lockedUntil,
    }).where(eq(appUser.id, user.id))

    if (target) {
      await recordAudit({
        actorUserId: user.id, actorSiteId: target.id, targetSiteId: target.id,
        action: 'login_failed', entityType: 'app_user', entityId: user.id,
        ipAddress: input.ipAddress,
      })
    }
    return fail
  }

  if (!target) return fail

  // ── 검증 2·3: 선택한 사업장에 대한 활성 권한 ──────────────────
  // 겸직 구조의 핵심. FRH 담당자가 드롭다운에서 FRK 를 골라도
  // FRK 권한이 없으면 로그인 자체가 실패한다.
  const membership = (await db.select({ role: userSiteMembership.role })
    .from(userSiteMembership)
    .where(and(
      eq(userSiteMembership.userId, user.id),
      eq(userSiteMembership.siteId, target.id),
      isNull(userSiteMembership.revokedAt),
    )).limit(1))[0]

  // System Admin 도 사업장을 선택해 로그인하지만 멤버십 검사는 면제된다.
  // 다만 전사 데이터가 자동으로 보이지는 않는다 — 평소에는 선택한
  // 사업장만 보이며, 전사 조회는 별도 관리 콘솔에서만 가능하다.
  if (!membership && !user.isSystemAdmin) {
    await recordAudit({
      actorUserId: user.id, actorSiteId: target.id, targetSiteId: target.id,
      action: 'login_failed', entityType: 'membership', entityId: target.id,
      detail: { reason: 'no_membership' }, ipAddress: input.ipAddress,
    })
    return fail
  }

  const role = membership?.role ?? 'site_admin'
  await db.update(appUser).set({
    failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(),
  }).where(eq(appUser.id, user.id))

  const token = await createSession({
    userId: user.id, siteId: target.id, role,
    isSystemAdmin: user.isSystemAdmin,
    ipAddress: input.ipAddress, userAgent: input.userAgent,
  })

  await recordAudit({
    actorUserId: user.id, actorSiteId: target.id, targetSiteId: target.id,
    action: 'login', ipAddress: input.ipAddress,
  })

  return { ok: true, token }
}

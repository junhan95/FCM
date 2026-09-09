import { cookies, headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { SESSION_COOKIE, resolveSession, type SessionContext } from './session'

/**
 * 인증 게이트.
 *
 * 보호된 모든 페이지와 라우트 핸들러가 이 함수를 호출한다.
 * 미들웨어의 쿠키 검사는 비용이 싼 1차 걸러내기일 뿐이며, 실제 방어선은 여기다.
 * 미들웨어만 믿으면 안 되는 이유:
 *   - 미들웨어는 쿠키 "존재" 만 보고 유효성은 보지 않는다 (엣지에서 DB 접근 불가)
 *   - matcher 설정에서 경로 하나만 빠져도 그 경로는 무방비가 된다
 *
 * 문서: docs/05-인증접근제어.md §4 (L2)
 */
export async function requireSession(): Promise<SessionContext> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const session = await resolveSession(token)
  if (!session) redirect('/login')
  return session
}

export async function getSession(): Promise<SessionContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return resolveSession(token)
}

/**
 * 역할 게이트 (L3). 기능 단위 인가.
 *
 * 이것만으로는 부족하다는 점이 중요하다. 로그인했고(L2) 고객 조회 권한도
 * 있는(L3) FRK 담당자가 FRH 고객 상세를 요청하는 경우는 L4(객체 인가)에서
 * 막힌다. L4 는 withSite() + RLS 가 담당한다.
 */
export async function requireRole(
  min: 'staff' | 'site_admin' | 'system_admin',
): Promise<SessionContext> {
  const s = await requireSession()
  const ok =
    min === 'staff' ? true
    : min === 'site_admin' ? (s.role === 'site_admin' || s.isSystemAdmin)
    : s.isSystemAdmin
  // 권한이 없으면 존재 자체를 감춘다 — 403 은 "그 기능이 있긴 하다" 를 알려준다.
  if (!ok) notFound()
  return s
}

export async function clientIp(): Promise<string | undefined> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
}

export async function clientUserAgent(): Promise<string | undefined> {
  return (await headers()).get('user-agent') ?? undefined
}

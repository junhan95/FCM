import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { requireSession } from '@/lib/auth/guard'
import { revokeSessionByToken, SESSION_COOKIE } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

/**
 * 인증 게이트. 이 레이아웃 아래의 모든 페이지가 여기를 통과한다.
 * 다만 각 페이지도 자체적으로 세션을 요구한다 — 레이아웃 하나에 의존하면
 * 렌더링 경로가 바뀔 때 조용히 뚫릴 수 있다.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await requireSession()

  async function logout() {
    'use server'
    const jar = await cookies()
    const token = jar.get(SESSION_COOKIE)?.value
    if (token) await revokeSessionByToken(token)
    jar.delete(SESSION_COOKIE)
    redirect('/login')
  }

  return (
    <>
      <header className="top">
        <div className="wrap">
          <span className="site">FCM</span>
          {/* 현재 어느 사업장 환경에 있는지 항상 보이게 한다.
              사업장을 착각한 채 작업하는 것이 실무에서 가장 흔한 사고다. */}
          <span className="badge">{s.siteCode}</span>
          <nav>
            <Link href="/workspace">Workspace</Link>
            <Link href="/contacts">담당자</Link>
            <Link href="/companies">고객사</Link>
            <Link href="/import">업로드</Link>
            {(s.role === 'site_admin' || s.isSystemAdmin) && (
              <Link href="/admin/users">사용자</Link>
            )}
          </nav>
          <span className="who">
            {s.displayName}
            {s.isSystemAdmin ? ' · System Admin' : s.role === 'site_admin' ? ' · Site Admin' : ''}
          </span>
          <form action={logout}>
            <button className="secondary" type="submit">로그아웃</button>
          </form>
        </div>
      </header>
      <div className="wrap">{children}</div>
    </>
  )
}

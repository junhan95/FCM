import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { getAppDb } from '@/db'
import { requireRole } from '@/lib/auth/guard'
import { revokeSessionsForUserAtSite } from '@/lib/auth/session'
import { recordAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * 사업장 사용자·권한 관리 (E-13).
 *
 * Site Admin 은 자기 사업장의 권한만 부여·회수할 수 있다.
 * 신원 계정 생성은 System Admin 전용이다 — 겸직 구조에서 Site Admin 에게
 * 계정 생성까지 허용하면, 자기가 만든 계정에 타 사업장 권한을 붙이는
 * 경로가 생길 수 있다. 문서: docs/04-사이트권한구조.md §4-7
 */
export default async function UsersPage() {
  const s = await requireRole('site_admin')
  const db = getAppDb()

  // 현재 세션 사업장의 멤버십만 조회한다.
  const members = await db.execute(sql`
    select u.id, u.login_id, u.display_name, u.is_active, u.is_system_admin,
           m.id as membership_id, m.role, m.granted_at
    from user_site_membership m
    join app_user u on u.id = m.user_id
    where m.site_id = ${s.siteId}::uuid and m.revoked_at is null
    order by u.display_name
  `)

  async function revoke(formData: FormData) {
    'use server'
    const sess = await requireRole('site_admin')
    const membershipId = String(formData.get('membershipId') ?? '')
    const userId = String(formData.get('userId') ?? '')
    if (!membershipId || !userId) redirect('/admin/users')

    // site_id 조건을 반드시 함께 건다 — 멤버십 ID 만으로 업데이트하면
    // 타 사업장 멤버십을 회수할 수 있게 된다.
    // user_site_membership 은 사업장 종속 테이블이 아니라 RLS 대상이 아니므로,
    // 여기서는 애플리케이션이 조건을 책임진다.
    const r = await getAppDb().execute(sql`
      update user_site_membership set revoked_at = now()
      where id = ${membershipId}::uuid
        and site_id = ${sess.siteId}::uuid
        and revoked_at is null
    `)
    if ((r.rowCount ?? 0) > 0) {
      // 권한을 회수하면 해당 사업장 세션도 즉시 무효화한다 (E-15).
      await revokeSessionsForUserAtSite(userId, sess.siteId)
      await recordAudit({
        actorUserId: sess.userId, actorSiteId: sess.siteId, targetSiteId: sess.siteId,
        action: 'permission_change', entityType: 'user_site_membership',
        entityId: membershipId, detail: { op: 'revoke' },
      })
    }
    redirect('/admin/users')
  }

  return (
    <main>
      <h1>{s.siteCode} 사용자</h1>
      <p className="muted">
        이 화면은 <strong>{s.siteCode}</strong> 사업장의 권한만 다룹니다.
        같은 사람이 다른 사업장에서 다른 역할을 가질 수 있습니다.
      </p>

      <table>
        <thead>
          <tr><th>이름</th><th>ID</th><th>이 사업장 역할</th><th>부여일</th><th>상태</th><th /></tr>
        </thead>
        <tbody>
          {(members.rows as any[]).map((m) => (
            <tr key={m.membership_id}>
              <td>{m.display_name}</td>
              <td>{m.login_id}</td>
              <td>
                <span className="badge">{m.role === 'site_admin' ? 'Site Admin' : 'Staff'}</span>
                {m.is_system_admin && <span className="badge" style={{ marginLeft: 4 }}>System Admin</span>}
              </td>
              <td>{new Date(m.granted_at).toLocaleDateString('ko-KR')}</td>
              <td>{m.is_active ? '활성' : '비활성'}</td>
              <td>
                <form action={revoke}>
                  <input type="hidden" name="membershipId" value={m.membership_id} />
                  <input type="hidden" name="userId" value={m.id} />
                  <button className="secondary" type="submit">권한 회수</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="muted" style={{ fontSize: 12, marginTop: '1rem' }}>
        신원 계정 생성·비활성화는 System Administrator 전용입니다.
        권한을 회수하면 해당 사업장의 활성 세션이 즉시 무효화됩니다.
      </p>
    </main>
  )
}

import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/guard'
import { listCompanies, createCompany } from '@/lib/repo/contacts'
import { recordAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const s = await requireSession()
  const rows = await listCompanies(s.siteId)

  async function create(formData: FormData) {
    'use server'
    const sess = await requireSession()
    const name = String(formData.get('name') ?? '').trim()
    if (!name) redirect('/companies')
    const id = await createCompany(sess.siteId, {
      name,
      country: String(formData.get('country') ?? '').trim() || null,
      category: String(formData.get('category') ?? '').trim() || null,
    })
    await recordAudit({
      actorUserId: sess.userId, actorSiteId: sess.siteId, targetSiteId: sess.siteId,
      action: 'create', entityType: 'company', entityId: id,
    })
    redirect('/companies')
  }

  return (
    <main>
      <h1>고객사 <span className="muted" style={{ fontSize: 14 }}>{rows.length}곳</span></h1>

      <form action={create} className="filters">
        <input name="name" placeholder="고객사명" required />
        <input name="country" placeholder="국가" />
        <input name="category" placeholder="업종" />
        <button type="submit">추가</button>
      </form>

      <table>
        <thead><tr><th>고객사</th><th>국가</th><th>업종</th><th>담당자 수</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.country ?? '—'}</td>
              <td>{c.category ?? '—'}</td>
              <td>{c.contact_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted">등록된 고객사가 없습니다.</p>}
    </main>
  )
}

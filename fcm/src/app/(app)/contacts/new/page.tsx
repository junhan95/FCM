import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/guard'
import { createContact, listCompanies } from '@/lib/repo/contacts'
import { recordAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export default async function NewContact() {
  const s = await requireSession()
  const companies = await listCompanies(s.siteId)

  async function create(formData: FormData) {
    'use server'
    const sess = await requireSession()
    const get = (k: string) => String(formData.get(k) ?? '').trim() || null
    const name = get('name')
    if (!name) redirect('/contacts/new?error=1')

    // 고객사 목록도 세션 사업장 것만 조회되므로, 폼에서 임의의 company_id 를
    // 넣어도 RLS 의 WITH CHECK 에 걸린다.
    const id = await createContact(sess.siteId, {
      name,
      email: get('email'), phone: get('phone'), position: get('position'),
      department: get('department'), category: get('category'),
      language: get('language'), country: get('country'),
      companyId: get('companyId'),
      ownerUserId: sess.userId,
    })
    await recordAudit({
      actorUserId: sess.userId, actorSiteId: sess.siteId, targetSiteId: sess.siteId,
      action: 'create', entityType: 'contact', entityId: id,
    })
    redirect(`/contacts/${id}`)
  }

  return (
    <main>
      <p><Link href="/contacts">← 담당자 목록</Link></p>
      <h1>새 담당자</h1>
      <form action={create} className="card" style={{ maxWidth: 720 }}>
        <div className="grid2">
          <div>
            <label htmlFor="name">이름 *</label>
            <input id="name" name="name" required style={{ width: '100%' }} />
          </div>
          <div>
            <label htmlFor="companyId">고객사</label>
            <select id="companyId" name="companyId" style={{ width: '100%' }} defaultValue="">
              <option value="">미지정</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {['email', 'phone', 'department', 'position', 'category', 'language', 'country']
            .map((k) => (
              <div key={k}>
                <label htmlFor={k}>{LABELS[k]}</label>
                <input id={k} name={k} style={{ width: '100%' }} />
              </div>
            ))}
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          동의 상태는 <strong>미확인</strong>으로 등록됩니다. 근거를 확인한 뒤 개별로 승격합니다.
        </p>
        <p style={{ marginBottom: 0 }}><button type="submit">등록</button></p>
      </form>
    </main>
  )
}

const LABELS: Record<string, string> = {
  email: '이메일', phone: '전화', department: '부서', position: '직위',
  category: '분류', language: '언어', country: '국가',
}

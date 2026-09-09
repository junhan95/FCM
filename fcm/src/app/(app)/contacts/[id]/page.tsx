import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireSession } from '@/lib/auth/guard'
import { getContact, updateContact } from '@/lib/repo/contacts'
import { recordAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * 요구사항 E-9·E-10 의 핵심 지점.
 *
 * 주소창에 /contacts/<타 사업장 uuid> 를 직접 입력해도 getContact 가 null 을
 * 반환한다 — RLS 가 조회 자체를 막기 때문이다. 그리고 403(권한 없음)이 아니라
 * 404(없음)로 응답한다. 403 을 주면 "그 ID 의 데이터가 존재하긴 한다" 는
 * 사실이 노출된다.
 */
export default async function ContactDetail({
  params,
}: { params: Promise<{ id: string }> }) {
  const s = await requireSession()
  const { id } = await params

  const c = await getContact(s.siteId, id)
  if (!c) {
    await recordAudit({
      actorUserId: s.userId, actorSiteId: s.siteId, targetSiteId: s.siteId,
      action: 'view', entityType: 'contact', entityId: id,
      detail: { result: 'not_found' },
    })
    notFound()
  }

  await recordAudit({
    actorUserId: s.userId, actorSiteId: s.siteId, targetSiteId: s.siteId,
    action: 'view', entityType: 'contact', entityId: id,
  })

  async function save(formData: FormData) {
    'use server'
    const sess = await requireSession()
    const data = Object.fromEntries(
      ['name', 'email', 'phone', 'position', 'department', 'category', 'language', 'country']
        .map((k) => [k, (String(formData.get(k) ?? '').trim() || null)]),
    ) as Record<string, string | null>

    const n = await updateContact(sess.siteId, id, data)
    // 0건이면 타 사업장 레코드를 건드리려 한 것이다 — 조용히 성공한 것처럼
    // 보이지 않도록 404 로 응답한다.
    if (n === 0) notFound()

    await recordAudit({
      actorUserId: sess.userId, actorSiteId: sess.siteId, targetSiteId: sess.siteId,
      action: 'update', entityType: 'contact', entityId: id,
    })
    redirect(`/contacts/${id}`)
  }

  const v = (k: string) => (c[k] as string | null) ?? ''

  return (
    <main>
      <p><Link href="/contacts">← 담당자 목록</Link></p>
      <h1>{v('name')}</h1>
      <p className="muted">
        {v('company_name') || '고객사 미지정'} · 동의 {v('consent_status')}
      </p>

      <form action={save} className="card" style={{ maxWidth: 720 }}>
        <div className="grid2">
          <Field name="name" label="이름" value={v('name')} required />
          <Field name="email" label="이메일" value={v('email')} type="email" />
          <Field name="phone" label="전화" value={v('phone')} />
          <Field name="department" label="부서" value={v('department')} />
          <Field name="position" label="직위" value={v('position')} />
          <Field name="category" label="분류" value={v('category')} />
          <Field name="language" label="언어" value={v('language')} />
          <Field name="country" label="국가" value={v('country')} />
        </div>
        <p style={{ marginBottom: 0 }}><button type="submit">저장</button></p>
      </form>
    </main>
  )
}

function Field({ name, label, value, type = 'text', required = false }: {
  name: string; label: string; value: string; type?: string; required?: boolean
}) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value}
             required={required} style={{ width: '100%' }} />
    </div>
  )
}

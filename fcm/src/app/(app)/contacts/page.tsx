import Link from 'next/link'
import { requireSession } from '@/lib/auth/guard'
import { listContacts } from '@/lib/repo/contacts'
import { recordAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export default async function ContactsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireSession()
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? '1') || 1)
  const limit = 50

  // siteId 는 세션에서만 온다. 쿼리스트링에 site 를 받지 않는 이유다.
  const { rows, total } = await listContacts(s.siteId, {
    q: sp.q, category: sp.category, country: sp.country,
    consentStatus: sp.consent, limit, offset: (page - 1) * limit,
  })

  await recordAudit({
    actorUserId: s.userId, actorSiteId: s.siteId, targetSiteId: s.siteId,
    action: 'view', entityType: 'contact_list',
    detail: { q: sp.q ?? null, count: rows.length },
  })

  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <main>
      <h1>담당자 <span className="muted" style={{ fontSize: 14 }}>{total}건</span></h1>

      <form className="filters" method="get">
        <input name="q" placeholder="이름 · 이메일 · 부서" defaultValue={sp.q ?? ''} />
        <input name="category" placeholder="분류" defaultValue={sp.category ?? ''} />
        <input name="country" placeholder="국가" defaultValue={sp.country ?? ''} />
        <select name="consent" defaultValue={sp.consent ?? ''}>
          <option value="">동의 상태 전체</option>
          <option value="unknown">미확인</option>
          <option value="granted">동의</option>
          <option value="withdrawn">철회</option>
        </select>
        <button type="submit">검색</button>
        <Link href="/contacts/new"><button type="button" className="secondary">새 담당자</button></Link>
      </form>

      {rows.length === 0 ? (
        <p className="muted">조건에 맞는 담당자가 없습니다.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>이름</th><th>고객사</th><th>이메일</th><th>부서 · 직위</th>
              <th>분류</th><th>국가</th><th>동의</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/contacts/${c.id}`}>{c.name}</Link></td>
                <td>{c.company_name ?? <span className="muted">—</span>}</td>
                <td>{c.email ?? <span className="muted">—</span>}</td>
                <td>{[c.department, c.position].filter(Boolean).join(' · ') || '—'}</td>
                <td>{c.category ?? '—'}</td>
                <td>{c.country ?? '—'}</td>
                <td><ConsentBadge value={c.consent_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pages > 1 && (
        <p style={{ marginTop: '1rem' }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={{ pathname: '/contacts', query: { ...sp, page: p } }}
                  style={{ marginRight: '.6rem', fontWeight: p === page ? 700 : 400 }}>
              {p}
            </Link>
          ))}
        </p>
      )}
    </main>
  )
}

function ConsentBadge({ value }: { value: string }) {
  const label = value === 'granted' ? '동의' : value === 'withdrawn' ? '철회' : '미확인'
  const color = value === 'granted' ? '#166534' : value === 'withdrawn' ? '#b91c1c' : '#92400e'
  return <span className="badge" style={{ color }}>{label}</span>
}

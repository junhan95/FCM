import { sql } from 'drizzle-orm'
import { withSite } from '@/lib/tenancy'

/**
 * 고객 데이터 접근.
 *
 * 모든 함수가 siteId 를 첫 인자로 받고 withSite() 를 거친다.
 * siteId 는 호출부에서 세션으로부터 오며, 요청 파라미터에서 오지 않는다.
 *
 * 조회 후 소속을 검사하는 방식(find(id) → if (x.siteId !== mine) reject)을
 * 쓰지 않는다. 조회 자체에 사업장 조건이 걸려 있어야 한다 — 검사를 빠뜨린
 * 코드 경로가 하나라도 생기면 그것이 유출 경로가 된다.
 * 문서: docs/05-인증접근제어.md §5-2
 */

export interface ContactRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  position: string | null
  department: string | null
  category: string | null
  language: string | null
  country: string | null
  consent_status: string
  company_name: string | null
  company_id: string | null
  owner_name: string | null
  last_contacted_at: Date | null
}

export interface ContactFilter {
  q?: string
  category?: string
  country?: string
  consentStatus?: string
  limit?: number
  offset?: number
}

export async function listContacts(siteId: string, f: ContactFilter = {}) {
  const limit = Math.min(f.limit ?? 50, 200)
  const offset = f.offset ?? 0
  return withSite(siteId, async (tx) => {
    const where = buildWhere(f)
    const rows = await tx.execute(sql`
      select c.id, c.name, c.email, c.phone, c.position, c.department,
             c.category, c.language, c.country, c.consent_status,
             c.company_id, co.name as company_name, u.display_name as owner_name,
             c.last_contacted_at
      from contact c
      left join company co on co.id = c.company_id
      left join app_user u on u.id = c.owner_user_id
      where c.is_active = true ${where}
      order by c.name
      limit ${limit} offset ${offset}
    `)
    const total = await tx.execute(sql`
      select count(*)::int as n from contact c where c.is_active = true ${where}
    `)
    return {
      rows: rows.rows as unknown as ContactRow[],
      total: (total.rows[0] as { n: number }).n,
    }
  })
}

function buildWhere(f: ContactFilter) {
  const parts = []
  if (f.q?.trim()) {
    const like = `%${f.q.trim().toLowerCase()}%`
    parts.push(sql` and (lower(c.name) like ${like} or lower(coalesce(c.email,'')) like ${like}
                    or lower(coalesce(c.department,'')) like ${like})`)
  }
  if (f.category) parts.push(sql` and c.category = ${f.category}`)
  if (f.country) parts.push(sql` and c.country = ${f.country}`)
  if (f.consentStatus) parts.push(sql` and c.consent_status = ${f.consentStatus}`)
  return parts.length ? sql.join(parts) : sql``
}

/**
 * 단건 조회. 없으면 null 을 반환하고 호출부는 404 로 응답한다.
 *
 * 타 사업장 레코드는 RLS 가 걸러내므로 여기서도 null 이 된다 — 즉
 * "권한 없음(403)" 이 아니라 "없음(404)" 이 된다. 403 을 주면 그 ID 의
 * 데이터가 존재한다는 사실이 노출된다.
 */
export async function getContact(siteId: string, id: string) {
  if (!isUuid(id)) return null
  return withSite(siteId, async (tx) => {
    const r = await tx.execute(sql`
      select c.*, co.name as company_name
      from contact c left join company co on co.id = c.company_id
      where c.id = ${id}::uuid limit 1
    `)
    return (r.rows[0] as Record<string, unknown> | undefined) ?? null
  })
}

export async function createContact(siteId: string, data: {
  name: string; email?: string | null; phone?: string | null
  position?: string | null; department?: string | null; category?: string | null
  language?: string | null; country?: string | null; companyId?: string | null
  ownerUserId?: string | null
}) {
  return withSite(siteId, async (tx) => {
    const r = await tx.execute(sql`
      insert into contact (site_id, company_id, name, email, email_normalized,
                           phone, position, department, category, language, country,
                           owner_user_id)
      values (${siteId}::uuid, ${data.companyId ?? null}, ${data.name},
              ${data.email ?? null}, ${normalizeEmail(data.email)},
              ${data.phone ?? null}, ${data.position ?? null}, ${data.department ?? null},
              ${data.category ?? null}, ${data.language ?? null}, ${data.country ?? null},
              ${data.ownerUserId ?? null})
      returning id
    `)
    return (r.rows[0] as { id: string }).id
  })
}

export async function updateContact(siteId: string, id: string, data: Record<string, string | null>) {
  if (!isUuid(id)) return 0
  return withSite(siteId, async (tx) => {
    const r = await tx.execute(sql`
      update contact set
        name = ${data.name ?? null},
        email = ${data.email ?? null},
        email_normalized = ${normalizeEmail(data.email)},
        phone = ${data.phone ?? null},
        position = ${data.position ?? null},
        department = ${data.department ?? null},
        category = ${data.category ?? null},
        language = ${data.language ?? null},
        country = ${data.country ?? null},
        updated_at = now()
      where id = ${id}::uuid
    `)
    return r.rowCount ?? 0
  })
}

export async function listCompanies(siteId: string) {
  return withSite(siteId, async (tx) => {
    const r = await tx.execute(sql`
      select co.id, co.name, co.country, co.category,
             (select count(*)::int from contact c where c.company_id = co.id) as contact_count
      from company co order by co.name
    `)
    return r.rows as unknown as {
      id: string; name: string; country: string | null
      category: string | null; contact_count: number
    }[]
  })
}

export async function createCompany(siteId: string, data: {
  name: string; country?: string | null; category?: string | null; address?: string | null
}) {
  return withSite(siteId, async (tx) => {
    const r = await tx.execute(sql`
      insert into company (site_id, name, country, category, address)
      values (${siteId}::uuid, ${data.name}, ${data.country ?? null},
              ${data.category ?? null}, ${data.address ?? null})
      returning id
    `)
    return (r.rows[0] as { id: string }).id
  })
}

export function normalizeEmail(email?: string | null): string | null {
  const v = email?.trim().toLowerCase()
  return v ? v : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(v: string): boolean {
  return UUID_RE.test(v)
}

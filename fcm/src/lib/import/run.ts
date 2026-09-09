import { sql } from 'drizzle-orm'
import { withSite } from '@/lib/tenancy'
import { normalizeEmail } from '@/lib/repo/contacts'
import { mapColumns, type Field, type ParsedFile } from './parse'

export interface ImportResult {
  batchId: string
  total: number
  created: number
  duplicate: number
  errorCount: number
  mapping: Record<Field, string | null>
  errors: { row: number; reason: string }[]
}

/**
 * 업로드 실행 (A-3, A-4).
 *
 * 귀속 사업장은 "업로더가 속한 사업장" 이 아니라 **업로드 세션의 활성 사업장**이다.
 * 겸직자는 여러 사업장에 속할 수 있으므로 "속한 사업장" 만으로는 값이 결정되지 않는다.
 *
 * 중복 판정은 정규화된 이메일 기준이며, 파일 내 중복과 기존 데이터와의 중복을
 * 모두 건너뛴다. 이메일이 없는 행은 중복 판정이 불가능하므로 그대로 생성한다.
 *
 * 동의 상태는 전원 unknown 으로 들어간다 (F-15). 근거 없는 데이터를 "동의함"으로
 * 이관하면 이 시스템을 도입한 명분 자체가 무너진다.
 */
export async function runImport(opts: {
  siteId: string
  userId: string
  filename: string
  file: ParsedFile
}): Promise<ImportResult> {
  const mapping = mapColumns(opts.file.headers)
  const errors: { row: number; reason: string }[] = []

  return withSite(opts.siteId, async (tx) => {
    const batch = await tx.execute(sql`
      insert into import_batch (site_id, filename, uploaded_by, column_mapping, row_count_total)
      values (${opts.siteId}::uuid, ${opts.filename}, ${opts.userId}::uuid,
              ${JSON.stringify(mapping)}::jsonb, ${opts.file.rows.length})
      returning id
    `)
    const batchId = (batch.rows[0] as { id: string }).id

    // 기존 이메일 — RLS 덕분에 자기 사업장 것만 조회된다.
    const existing = await tx.execute(sql`
      select email_normalized from contact where email_normalized is not null
    `)
    const seen = new Set(
      (existing.rows as { email_normalized: string }[]).map((r) => r.email_normalized),
    )

    const companyCache = new Map<string, string>()
    let created = 0, duplicate = 0

    for (const [i, raw] of opts.file.rows.entries()) {
      const rowNo = i + 2 // 1행은 헤더
      const get = (f: Field) => {
        const col = mapping[f]
        return col ? (raw[col] ?? '').trim() : ''
      }

      const name = get('name')
      const email = normalizeEmail(get('email'))

      if (!name && !email) { errors.push({ row: rowNo, reason: '이름과 이메일이 모두 비어 있음' }); continue }

      if (email && seen.has(email)) { duplicate++; continue }

      try {
        let companyId: string | null = null
        const companyName = get('company')
        if (companyName) {
          const key = companyName.toLowerCase()
          companyId = companyCache.get(key) ?? null
          if (!companyId) {
            const found = await tx.execute(sql`
              select id from company where lower(name) = ${key} limit 1
            `)
            companyId = (found.rows[0] as { id: string } | undefined)?.id ?? null
            if (!companyId) {
              const ins = await tx.execute(sql`
                insert into company (site_id, name, country, category)
                values (${opts.siteId}::uuid, ${companyName},
                        ${get('country') || null}, ${get('category') || null})
                returning id
              `)
              companyId = (ins.rows[0] as { id: string }).id
            }
            companyCache.set(key, companyId)
          }
        }

        await tx.execute(sql`
          insert into contact
            (site_id, company_id, name, email, email_normalized, phone,
             position, department, category, language, country,
             consent_status, source, import_batch_id)
          values
            (${opts.siteId}::uuid, ${companyId}, ${name || email!}, ${get('email') || null},
             ${email}, ${get('phone') || null}, ${get('position') || null},
             ${get('department') || null}, ${get('category') || null},
             ${get('language') || null}, ${get('country') || null},
             'unknown', 'spreadsheet_import', ${batchId}::uuid)
        `)
        if (email) seen.add(email)
        created++
      } catch (e) {
        errors.push({ row: rowNo, reason: e instanceof Error ? e.message : String(e) })
      }
    }

    await tx.execute(sql`
      update import_batch set
        row_count_created = ${created},
        row_count_duplicate = ${duplicate},
        row_count_error = ${errors.length},
        error_detail = ${JSON.stringify(errors.slice(0, 100))}::jsonb,
        status = 'completed'
      where id = ${batchId}::uuid
    `)

    return {
      batchId, total: opts.file.rows.length,
      created, duplicate, errorCount: errors.length, mapping, errors,
    }
  })
}

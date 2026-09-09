import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { closePools } from '@/db'
import { withSite } from '@/lib/tenancy'
import { mapColumns, parseCsv } from '@/lib/import/parse'
import { runImport } from '@/lib/import/run'
import { siteIds, makeUser } from './helpers'

/**
 * 스프레드시트 업로드 테스트 (A-1~A-4, F-15).
 */

let FRH: string, FRK: string, userId: string
const tag = () => randomBytes(4).toString('hex')

beforeAll(async () => {
  const s = await siteIds()
  FRH = s['FRH']!; FRK = s['FRK']!
  userId = (await makeUser({ memberships: [{ siteId: FRH, role: 'staff' }] })).userId
})

afterAll(async () => { await closePools() })

describe('컬럼 정규화 (A-2)', () => {
  it('영어 헤더를 인식한다', () => {
    const m = mapColumns(['Name', 'E-Mail', 'Company', 'Category', 'Country', 'Phone'])
    expect(m.name).toBe('Name')
    expect(m.email).toBe('E-Mail')
    expect(m.company).toBe('Company')
    expect(m.phone).toBe('Phone')
  })

  it('한국어·독일어 헤더를 인식한다', () => {
    const m = mapColumns(['담당자', '이메일', '고객사', '부서', 'Land'])
    expect(m.name).toBe('담당자')
    expect(m.email).toBe('이메일')
    expect(m.company).toBe('고객사')
    expect(m.department).toBe('부서')
    expect(m.country).toBe('Land')
  })

  it('대소문자·공백·기호를 무시한다', () => {
    const m = mapColumns([' E_Mail ', 'Full Name', 'company-name'])
    expect(m.email).toBe(' E_Mail ')
    expect(m.name).toBe('Full Name')
    expect(m.company).toBe('company-name')
  })

  it('인식하지 못한 필드는 null 로 둔다', () => {
    const m = mapColumns(['Foo', 'Bar'])
    expect(m.name).toBeNull()
    expect(m.email).toBeNull()
  })
})

describe('업로드 실행', () => {
  it('행을 생성하고 고객사를 자동으로 만든다', async () => {
    const t = tag()
    const csv = [
      'Name,Email,Company,Category,Country',
      `A ${t},a.${t}@example.com,Acme ${t},automotive,DE`,
      `B ${t},b.${t}@example.com,Acme ${t},automotive,DE`,
    ].join('\n')

    const r = await runImport({
      siteId: FRH, userId, filename: `t-${t}.csv`, file: parseCsv(csv),
    })
    expect(r.created).toBe(2)
    expect(r.errorCount).toBe(0)

    // 같은 고객사명은 한 번만 만들어진다.
    const companies = await withSite(FRH, async (tx) => {
      const x = await tx.execute(sql`select count(*)::int as n from company where name = ${'Acme ' + t}`)
      return (x.rows[0] as { n: number }).n
    })
    expect(companies).toBe(1)
  })

  it('동의 상태는 전원 unknown 으로 들어간다 (F-15)', async () => {
    // 근거 없는 데이터를 "동의함" 으로 이관하면 이 시스템을 도입한 명분이 사라진다.
    const t = tag()
    const csv = `Name,Email\nC ${t},c.${t}@example.com`
    await runImport({ siteId: FRH, userId, filename: `t-${t}.csv`, file: parseCsv(csv) })

    const status = await withSite(FRH, async (tx) => {
      const x = await tx.execute(sql`
        select consent_status from contact where email_normalized = ${`c.${t}@example.com`}
      `)
      return (x.rows[0] as { consent_status: string }).consent_status
    })
    expect(status).toBe('unknown')
  })

  it('이메일이 같은 행은 중복으로 건너뛴다 (A-3)', async () => {
    const t = tag()
    const email = `dup.${t}@example.com`
    const first = await runImport({
      siteId: FRH, userId, filename: 'a.csv',
      file: parseCsv(`Name,Email\nX ${t},${email}`),
    })
    expect(first.created).toBe(1)

    // 기존 데이터와의 중복
    const second = await runImport({
      siteId: FRH, userId, filename: 'b.csv',
      file: parseCsv(`Name,Email\nY ${t},${email}`),
    })
    expect(second.created).toBe(0)
    expect(second.duplicate).toBe(1)
  })

  it('파일 안에서 중복된 이메일도 한 번만 들어간다', async () => {
    const t = tag()
    const email = `inner.${t}@example.com`
    const r = await runImport({
      siteId: FRH, userId, filename: 'c.csv',
      file: parseCsv(`Name,Email\nP ${t},${email}\nQ ${t},${email.toUpperCase()}`),
    })
    // 대문자로 써도 정규화되어 같은 값으로 판정된다.
    expect(r.created).toBe(1)
    expect(r.duplicate).toBe(1)
  })

  it('완전히 빈 행은 조용히 무시한다 (오류가 아니다)', async () => {
    // 스프레드시트 하단의 빈 줄은 흔하다. 이것을 오류로 세면 결과 화면이
    // 의미 없는 경고로 채워진다.
    const t = tag()
    const r = await runImport({
      siteId: FRH, userId, filename: 'd.csv',
      file: parseCsv(`Name,Email\nZ ${t},z.${t}@example.com\n,\n\n`),
    })
    expect(r.created).toBe(1)
    expect(r.errorCount).toBe(0)
  })

  it('내용은 있으나 이름·이메일이 없는 행은 오류로 기록한다', async () => {
    // 전화번호만 있는 행 같은 경우. 식별할 수단이 없으므로 넣지 않고
    // 몇 행이었는지 알려준다 — 조용히 버리면 사용자가 누락을 눈치채지 못한다.
    const t = tag()
    const r = await runImport({
      siteId: FRH, userId, filename: 'd2.csv',
      file: parseCsv(`Name,Email,Phone\nZ ${t},z2.${t}@example.com,010-1111-2222\n,,010-3333-4444`),
    })
    expect(r.created).toBe(1)
    expect(r.errorCount).toBe(1)
    expect(r.errors[0]?.reason).toMatch(/비어/)
    expect(r.errors[0]?.row).toBe(3)
  })
})

describe('업로드 귀속 사업장 (A-4)', () => {
  it('업로드 세션의 활성 사업장으로 귀속되며 타 사업장에서 보이지 않는다', async () => {
    // "업로더가 속한 사업장" 이 아니라 "업로드 세션의 사업장" 이다.
    // 겸직자는 여러 사업장에 속하므로 전자는 값이 결정되지 않는다.
    const t = tag()
    const email = `scoped.${t}@example.com`
    await runImport({
      siteId: FRK, userId, filename: 'e.csv',
      file: parseCsv(`Name,Email\nScoped ${t},${email}`),
    })

    const inFrk = await countByEmail(FRK, email)
    const inFrh = await countByEmail(FRH, email)
    expect(inFrk).toBe(1)
    expect(inFrh).toBe(0)
  })

  it('같은 이메일을 두 사업장에 각각 업로드할 수 있다', async () => {
    // 완전 격리의 귀결 — 사업장 간 중복은 정상이다.
    const t = tag()
    const email = `both.${t}@example.com`
    const csv = `Name,Email\nBoth ${t},${email}`
    const a = await runImport({ siteId: FRH, userId, filename: 'f.csv', file: parseCsv(csv) })
    const b = await runImport({ siteId: FRK, userId, filename: 'f.csv', file: parseCsv(csv) })
    expect(a.created).toBe(1)
    expect(b.created).toBe(1)
  })

  it('업로드 이력이 사업장별로 기록되고 격리된다', async () => {
    const t = tag()
    const filename = `batch-${t}.csv`
    await runImport({
      siteId: FRH, userId, filename,
      file: parseCsv(`Name,Email\nBatch ${t},batch.${t}@example.com`),
    })
    const seenInFrh = await withSite(FRH, async (tx) => {
      const r = await tx.execute(sql`select count(*)::int as n from import_batch where filename = ${filename}`)
      return (r.rows[0] as { n: number }).n
    })
    const seenInFrk = await withSite(FRK, async (tx) => {
      const r = await tx.execute(sql`select count(*)::int as n from import_batch where filename = ${filename}`)
      return (r.rows[0] as { n: number }).n
    })
    expect(seenInFrh).toBe(1)
    expect(seenInFrk).toBe(0)
  })
})

async function countByEmail(siteId: string, email: string): Promise<number> {
  return withSite(siteId, async (tx) => {
    const r = await tx.execute(sql`
      select count(*)::int as n from contact where email_normalized = ${email}
    `)
    return (r.rows[0] as { n: number }).n
  })
}

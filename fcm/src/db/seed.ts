import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { getOwnerDb, closePools } from './index'
import { site, appUser, userSiteMembership, company, contact } from './schema'
import { hashPassword } from '../lib/password'

/**
 * 개발용 시드. 실고객 데이터는 절대 넣지 않는다 —
 * 로컬·스테이징에는 생성된 더미 데이터만 사용한다.
 * 문서: docs/08-개발흐름.md §3
 */

const SITES = [
  { code: 'FRH', name: 'Frankonia Germany EMC Solutions GmbH', city: 'Heideck',   country: 'DE', jurisdiction: 'eu_de', defaultLanguage: 'de' },
  { code: 'FRF', name: 'Frankonia EMC Test-Systems GmbH',      city: 'Forchheim', country: 'DE', jurisdiction: 'eu_de', defaultLanguage: 'de' },
  { code: 'FRJ', name: 'Frankonia (Jiashan)',                  city: 'Jiashan',   country: 'CN', jurisdiction: 'cn',    defaultLanguage: 'zh' },
  { code: 'FRK', name: 'Frankonia Korea EMC Solutions',        city: null,        country: 'KR', jurisdiction: 'kr',    defaultLanguage: 'ko' },
  { code: 'FRI', name: 'Frankonia India EMC Solutions Pvt. Ltd.', city: null,     country: 'IN', jurisdiction: 'in',    defaultLanguage: 'en' },
] as const

async function main() {
  const db = getOwnerDb()

  console.log('▸ 기존 시드 정리')
  // FORCE RLS 때문에 contact/company 는 사업장 컨텍스트가 필요하다.
  const existing = await db.select().from(site)
  for (const s of existing) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.site_id', ${s.id}, true)`)
      await tx.execute(sql`delete from contact`)
      await tx.execute(sql`delete from company`)
    })
  }
  await db.execute(sql`delete from user_site_membership`)
  await db.execute(sql`delete from user_session`)
  await db.execute(sql`delete from audit_log`)
  await db.execute(sql`delete from app_user`)
  await db.execute(sql`delete from site`)

  console.log('▸ 사업장 5곳')
  const sites = await db.insert(site).values(SITES.map((s) => ({ ...s }))).returning()
  const byCode = Object.fromEntries(sites.map((s) => [s.code, s]))

  console.log('▸ 사용자')
  const pw = await hashPassword('devonly-Passw0rd!')
  const users = await db.insert(appUser).values([
    { loginId: 'sysadmin', displayName: 'System Administrator', passwordHash: pw, isSystemAdmin: true,  mustChangePassword: false },
    { loginId: 'frh.admin', displayName: 'FRH Site Admin',      passwordHash: pw, mustChangePassword: false },
    { loginId: 'frh.staff', displayName: 'FRH Staff',           passwordHash: pw, mustChangePassword: false },
    { loginId: 'frk.staff', displayName: 'FRK Staff',           passwordHash: pw, mustChangePassword: false },
    // 겸직자 — FRH 에서는 staff, FRK 에서는 site_admin.
    // 역할이 사용자가 아니라 멤버십에 붙는 이유를 보여주는 사례.
    { loginId: 'dual.user', displayName: 'Dual Site User',      passwordHash: pw, mustChangePassword: false },
  ]).returning()
  const byLogin = Object.fromEntries(users.map((u) => [u.loginId, u]))

  console.log('▸ 사업장별 권한 부여')
  await db.insert(userSiteMembership).values([
    { userId: byLogin['frh.admin']!.id, siteId: byCode['FRH']!.id, role: 'site_admin' },
    { userId: byLogin['frh.staff']!.id, siteId: byCode['FRH']!.id, role: 'staff' },
    { userId: byLogin['frk.staff']!.id, siteId: byCode['FRK']!.id, role: 'staff' },
    { userId: byLogin['dual.user']!.id, siteId: byCode['FRH']!.id, role: 'staff' },
    { userId: byLogin['dual.user']!.id, siteId: byCode['FRK']!.id, role: 'site_admin' },
  ])

  console.log('▸ 사업장별 더미 고객')
  for (const s of sites) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.site_id', ${s.id}, true)`)
      const [co] = await tx.insert(company).values({
        siteId: s.id,
        name: `${s.code} Demo Customer Co.`,
        country: s.country,
        category: 'automotive',
      }).returning()
      await tx.insert(contact).values([
        {
          siteId: s.id, companyId: co!.id,
          name: `${s.code} Contact A`,
          // 같은 이메일이 모든 사업장에 존재한다 — 완전 격리에서는 정상이며,
          // 격리 테스트가 이 사실을 검증한다.
          email: 'shared.contact@example.com',
          emailNormalized: 'shared.contact@example.com',
          category: 'automotive', language: s.defaultLanguage, country: s.country,
        },
        {
          siteId: s.id, companyId: co!.id,
          name: `${s.code} Contact B`,
          email: `${s.code.toLowerCase()}.b@example.com`,
          emailNormalized: `${s.code.toLowerCase()}.b@example.com`,
          category: 'aerospace', language: s.defaultLanguage, country: s.country,
        },
      ])
    })
  }

  // 집계도 사업장 컨텍스트가 필요하다 — FORCE RLS 는 소유자에게도 적용된다.
  for (const s of sites) {
    const n = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.site_id', ${s.id}, true)`)
      const r = await tx.execute(sql`select count(*)::int as n from contact`)
      return (r.rows[0] as { n: number }).n
    })
    console.log(`  ${s.code}: contact ${n}건`)
  }
  console.log('완료')
  await closePools()
}

main().catch(async (e) => {
  console.error(e)
  await closePools()
  process.exit(1)
})

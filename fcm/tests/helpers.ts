import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getOwnerDb } from '@/db'
import { hashPassword } from '@/lib/password'

export const TEST_PASSWORD = 'Test-Passw0rd!'

export async function siteIds(): Promise<Record<string, string>> {
  const r = await getOwnerDb().execute(sql`select id, code from site`)
  return Object.fromEntries((r.rows as { id: string; code: string }[]).map((x) => [x.code, x.id]))
}

/** 시드 계정을 오염시키지 않도록 테스트마다 전용 계정을 만든다. */
export async function makeUser(opts: {
  memberships?: { siteId: string; role: 'staff' | 'site_admin' }[]
  isSystemAdmin?: boolean
} = {}) {
  const db = getOwnerDb()
  const loginId = `t_${randomBytes(6).toString('hex')}`
  const hash = await hashPassword(TEST_PASSWORD)
  const u = await db.execute(sql`
    insert into app_user (login_id, display_name, password_hash, is_system_admin, must_change_password)
    values (${loginId}, ${'Test ' + loginId}, ${hash}, ${opts.isSystemAdmin ?? false}, false)
    returning id
  `)
  const userId = (u.rows[0] as { id: string }).id
  for (const m of opts.memberships ?? []) {
    await db.execute(sql`
      insert into user_site_membership (user_id, site_id, role)
      values (${userId}::uuid, ${m.siteId}::uuid, ${m.role})
    `)
  }
  return { userId, loginId }
}

export async function membershipId(userId: string, siteId: string): Promise<string> {
  const r = await getOwnerDb().execute(sql`
    select id from user_site_membership
    where user_id = ${userId}::uuid and site_id = ${siteId}::uuid and revoked_at is null
  `)
  return (r.rows[0] as { id: string }).id
}

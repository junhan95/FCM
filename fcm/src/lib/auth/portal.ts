import { and, eq, isNull } from 'drizzle-orm'
import { getAppDb } from '@/db'
import { appUser, site, userSiteMembership } from '@/db/schema'
import { login } from './login'

// Select only an active site the account is authorized to use. The existing
// login function remains responsible for password checks, lockout and auditing.
export async function portalLogin(input: { loginId: string; password: string; ipAddress?: string; userAgent?: string }) {
  const db = getAppDb()
  const [user] = await db.select().from(appUser).where(eq(appUser.loginId, input.loginId.trim())).limit(1)
  const sites = user?.isSystemAdmin
    ? await db.select({ id: site.id }).from(site).where(eq(site.isActive, true)).orderBy(site.code).limit(1)
    : await db.select({ id: site.id }).from(site)
      .innerJoin(userSiteMembership, eq(userSiteMembership.siteId, site.id))
      .where(and(eq(userSiteMembership.userId, user?.id ?? '00000000-0000-0000-0000-000000000000'), isNull(userSiteMembership.revokedAt), eq(site.isActive, true)))
      .orderBy(site.code).limit(1)
  return login({ ...input, siteId: sites[0]?.id ?? '00000000-0000-0000-0000-000000000000' })
}

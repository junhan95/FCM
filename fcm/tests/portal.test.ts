import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { portalLogin } from '@/lib/auth/portal'
import { resolveSession } from '@/lib/auth/session'
import { closePools } from '@/db'
import { makeUser, siteIds, TEST_PASSWORD } from './helpers'
let FRK: string
beforeAll(async () => { FRK = (await siteIds()).FRK })
afterAll(closePools)
describe('Portal ID/password login', () => {
  it('selects an authorized site without accepting a site from the browser', async () => {
    const user = await makeUser({ memberships: [{ siteId: FRK, role: 'staff' }] })
    const result = await portalLogin({ loginId: user.loginId, password: TEST_PASSWORD })
    expect(result.ok).toBe(true)
    if (result.ok) {
      const session = await resolveSession(result.token)
      expect(session?.siteId).toBe(FRK)
      expect(session?.role).toBe('staff')
    }
  })
  it('rejects an account without active site membership', async () => {
    const user = await makeUser()
    expect((await portalLogin({ loginId: user.loginId, password: TEST_PASSWORD })).ok).toBe(false)
  })
  it('retains password validation', async () => {
    const user = await makeUser({ memberships: [{ siteId: FRK, role: 'staff' }] })
    expect((await portalLogin({ loginId: user.loginId, password: 'wrong' })).ok).toBe(false)
  })
})

import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { getOwnerDb, closePools } from '@/db'
import { login, LOGIN_FAILED } from '@/lib/auth/login'
import {
  resolveSession, revokeSessionByToken, revokeSessionsForUserAtSite,
} from '@/lib/auth/session'
import { siteIds, makeUser, TEST_PASSWORD } from './helpers'

/**
 * 인증 테스트.
 *
 * 로그인은 ID + 비밀번호 + 사업장 세 요소를 모두 요구하며,
 * 실패 사유를 구분해 노출하지 않는다.
 * 문서: docs/05-인증접근제어.md §2
 */

let FRH: string, FRF: string, FRK: string

beforeAll(async () => {
  const s = await siteIds()
  FRH = s['FRH']!; FRF = s['FRF']!; FRK = s['FRK']!
})

afterAll(async () => { await closePools() })

describe('로그인 3요소 검증', () => {
  it('올바른 자격증명과 권한 있는 사업장이면 성공한다', async () => {
    const u = await makeUser({ memberships: [{ siteId: FRH, role: 'staff' }] })
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRH })
    expect(r.ok).toBe(true)
  })

  it('비밀번호가 틀리면 실패한다', async () => {
    const u = await makeUser({ memberships: [{ siteId: FRH, role: 'staff' }] })
    const r = await login({ loginId: u.loginId, password: 'wrong', siteId: FRH })
    expect(r).toEqual({ ok: false, message: LOGIN_FAILED })
  })

  it('권한 없는 사업장을 선택하면 자격증명이 맞아도 실패한다', async () => {
    // 겸직 구조의 핵심 관문. FRH 담당자가 FRK 를 골라도 통과할 수 없다.
    const u = await makeUser({ memberships: [{ siteId: FRH, role: 'staff' }] })
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRK })
    expect(r).toEqual({ ok: false, message: LOGIN_FAILED })
  })

  it('회수된 권한으로는 로그인할 수 없다', async () => {
    const u = await makeUser({ memberships: [{ siteId: FRF, role: 'staff' }] })
    await getOwnerDb().execute(sql`
      update user_site_membership set revoked_at = now()
      where user_id = ${u.userId}::uuid and site_id = ${FRF}::uuid
    `)
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRF })
    expect(r.ok).toBe(false)
  })
})

describe('실패 사유 미구분', () => {
  it('없는 ID · 틀린 비밀번호 · 권한 없는 사업장이 모두 같은 메시지를 반환한다', async () => {
    // 사유를 구분해 주면 "이 ID 는 존재하나 사업장이 틀렸다" 는 정보가 새어,
    // 어떤 담당자가 어느 사업장 소속인지를 외부에서 알아낼 수 있다.
    const u = await makeUser({ memberships: [{ siteId: FRH, role: 'staff' }] })
    const results = await Promise.all([
      login({ loginId: 'no_such_user_xyz', password: TEST_PASSWORD, siteId: FRH }),
      login({ loginId: u.loginId, password: 'wrong-password', siteId: FRH }),
      login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRK }),
    ])
    const messages = new Set(results.map((r) => (r.ok ? 'OK' : r.message)))
    expect(messages.size).toBe(1)
    expect([...messages][0]).toBe(LOGIN_FAILED)
  })

  it('세 경우의 응답 시간이 서로 비슷하다', async () => {
    // 시간차로도 같은 정보가 샌다. 존재하지 않는 계정에도 해시 검증을 수행하고
    // 최소 응답 시간 하한을 둔다.
    const u = await makeUser({ memberships: [{ siteId: FRH, role: 'staff' }] })
    const times: number[] = []
    for (const args of [
      { loginId: 'no_such_user_abc', password: TEST_PASSWORD, siteId: FRH },
      { loginId: u.loginId, password: 'wrong-password', siteId: FRH },
      { loginId: u.loginId, password: TEST_PASSWORD, siteId: FRK },
    ]) {
      const t = Date.now()
      await login(args)
      times.push(Date.now() - t)
    }
    const min = Math.min(...times), max = Math.max(...times)
    // 하한(400ms)이 걸려 있으므로 편차가 크지 않아야 한다.
    expect(max - min).toBeLessThan(300)
  })
})

describe('계정 잠금', () => {
  it('연속 실패 후에는 올바른 비밀번호로도 로그인되지 않는다', async () => {
    const u = await makeUser({ memberships: [{ siteId: FRH, role: 'staff' }] })
    for (let i = 0; i < 5; i++) {
      await login({ loginId: u.loginId, password: 'wrong', siteId: FRH })
    }
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRH })
    expect(r.ok).toBe(false)
  })
})

describe('세션', () => {
  it('세션은 로그인 시 선택한 사업장에 바인딩된다', async () => {
    const u = await makeUser({ memberships: [{ siteId: FRK, role: 'staff' }] })
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRK })
    if (!r.ok) throw new Error('로그인 실패')
    const ctx = await resolveSession(r.token)
    expect(ctx?.siteId).toBe(FRK)
    expect(ctx?.siteCode).toBe('FRK')
  })

  it('겸직자는 사업장별로 다른 역할을 갖는다', async () => {
    // 역할이 사용자가 아니라 사업장 권한 부여에 붙는 이유.
    const u = await makeUser({
      memberships: [
        { siteId: FRH, role: 'staff' },
        { siteId: FRK, role: 'site_admin' },
      ],
    })
    const a = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRH })
    if (!a.ok) throw new Error('FRH 로그인 실패')
    expect((await resolveSession(a.token))?.role).toBe('staff')

    const b = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRK })
    if (!b.ok) throw new Error('FRK 로그인 실패')
    expect((await resolveSession(b.token))?.role).toBe('site_admin')
  })

  it('새 로그인은 기존 세션을 폐기한다 (계정당 1개)', async () => {
    // "다른 사업장에 접근하려면 다시 로그인" 의 직접 구현.
    // 두 사업장을 동시에 열어 두고 헷갈리는 상황을 구조적으로 막는다.
    const u = await makeUser({
      memberships: [{ siteId: FRH, role: 'staff' }, { siteId: FRK, role: 'staff' }],
    })
    const first = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRH })
    if (!first.ok) throw new Error('실패')
    expect(await resolveSession(first.token)).not.toBeNull()

    const second = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRK })
    if (!second.ok) throw new Error('실패')

    expect(await resolveSession(first.token)).toBeNull()
    expect((await resolveSession(second.token))?.siteCode).toBe('FRK')
  })

  it('권한을 회수하면 해당 사업장 세션이 즉시 무효화된다', async () => {
    const u = await makeUser({ memberships: [{ siteId: FRH, role: 'staff' }] })
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRH })
    if (!r.ok) throw new Error('실패')
    expect(await resolveSession(r.token)).not.toBeNull()

    await getOwnerDb().execute(sql`
      update user_site_membership set revoked_at = now()
      where user_id = ${u.userId}::uuid and site_id = ${FRH}::uuid
    `)
    await revokeSessionsForUserAtSite(u.userId, FRH)

    expect(await resolveSession(r.token)).toBeNull()
  })

  it('멤버십이 사라지면 세션 검증 단계에서도 걸러진다', async () => {
    // 세션 폐기를 깜빡해도 매 요청 재확인이 잡아낸다 (다층 방어).
    const u = await makeUser({ memberships: [{ siteId: FRF, role: 'staff' }] })
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRF })
    if (!r.ok) throw new Error('실패')

    await getOwnerDb().execute(sql`
      update user_site_membership set revoked_at = now()
      where user_id = ${u.userId}::uuid and site_id = ${FRF}::uuid
    `)
    // 세션은 일부러 폐기하지 않는다.
    expect(await resolveSession(r.token)).toBeNull()
  })

  it('계정을 비활성화하면 세션이 무효가 된다', async () => {
    const u = await makeUser({ memberships: [{ siteId: FRH, role: 'staff' }] })
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRH })
    if (!r.ok) throw new Error('실패')
    await getOwnerDb().execute(sql`
      update app_user set is_active = false where id = ${u.userId}::uuid
    `)
    expect(await resolveSession(r.token)).toBeNull()
  })

  it('로그아웃하면 세션이 무효가 된다', async () => {
    const u = await makeUser({ memberships: [{ siteId: FRH, role: 'staff' }] })
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRH })
    if (!r.ok) throw new Error('실패')
    await revokeSessionByToken(r.token)
    expect(await resolveSession(r.token)).toBeNull()
  })

  it('위조된 토큰은 통하지 않는다', async () => {
    expect(await resolveSession('not-a-real-token')).toBeNull()
    expect(await resolveSession('')).toBeNull()
    expect(await resolveSession(undefined)).toBeNull()
  })
})

describe('System Administrator', () => {
  it('멤버십이 없는 사업장도 선택해 로그인할 수 있다', async () => {
    // 이 계정에는 어떤 멤버십도 부여하지 않았다.
    const u = await makeUser({ isSystemAdmin: true })
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRF })
    expect(r.ok).toBe(true)
  })

  it('로그인 직후에는 선택한 사업장만 보인다', async () => {
    // 전사 권한이 있어도 평소에는 일반 사용자와 같다.
    // 전사 조회는 별도 관리 콘솔에서만 가능하다 (docs/05 §2-5).
    const u = await makeUser({ isSystemAdmin: true })
    const r = await login({ loginId: u.loginId, password: TEST_PASSWORD, siteId: FRK })
    if (!r.ok) throw new Error('실패')
    const ctx = await resolveSession(r.token)
    expect(ctx?.siteId).toBe(FRK)
    expect(ctx?.isSystemAdmin).toBe(true)
  })
})

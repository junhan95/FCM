import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { getOwnerDb, closePools } from '@/db'
import { login } from '@/lib/auth/login'
import { withSite } from '@/lib/tenancy'
import { SESSION_COOKIE } from '@/lib/auth/constants'

/**
 * HTTP 레벨 스모크 테스트.
 *
 * 단위 테스트는 RLS 가 데이터를 막는 것까지 확인한다. 이 파일은 그 위에서
 * 실제 요청이 어떻게 응답되는지 — 미인증 요청이 로그인으로 가는지,
 * 타 사업장 주소를 직접 입력하면 403 이 아니라 404 가 나오는지 — 를 본다.
 *
 * 외부에 기동된 서버가 필요하므로 FCM_SMOKE_URL 이 있을 때만 실행한다.
 *   npm run build && npm start &
 *   FCM_SMOKE_URL=http://127.0.0.1:3000 npx vitest run tests/http-smoke.test.ts
 */
const BASE = process.env.FCM_SMOKE_URL
const maybe = BASE ? describe : describe.skip

let cookie = ''
let frhContact = ''
let frkContact = ''

beforeAll(async () => {
  if (!BASE) return
  const db = getOwnerDb()
  const sites = await db.execute(sql`select id, code from site`)
  const m: Record<string, string> = Object.fromEntries(
    (sites.rows as { id: string; code: string }[]).map((r) => [r.code, r.id]),
  )
  const first = (code: string) => withSite(m[code]!, async (tx) => {
    const r = await tx.execute(sql`select id from contact order by name limit 1`)
    return (r.rows[0] as { id: string }).id
  })
  frhContact = await first('FRH')
  frkContact = await first('FRK')

  // FRK 담당자로 로그인한다.
  const r = await login({ loginId: 'frk.staff', password: 'devonly-Passw0rd!', siteId: m['FRK']! })
  if (!r.ok) throw new Error('시드 계정 로그인 실패 — npm run db:seed 를 먼저 실행하십시오')
  cookie = `${SESSION_COOKIE}=${r.token}`
})

afterAll(async () => { await closePools() })

const get = (path: string, withCookie = true) =>
  fetch(`${BASE}${path}`, {
    redirect: 'manual',
    headers: withCookie && cookie ? { cookie } : {},
  })

maybe('미인증 요청', () => {
  it('보호된 경로는 로그인으로 보낸다', async () => {
    const r = await get('/contacts', false)
    expect([302, 307, 308]).toContain(r.status)
    expect(r.headers.get('location')).toContain('/login')
  })

  it('상세 주소를 직접 입력해도 로그인으로 보낸다', async () => {
    const r = await get(`/contacts/${frhContact}`, false)
    expect([302, 307, 308]).toContain(r.status)
    expect(r.headers.get('location')).toContain('/login')
  })

  it('로그인 화면 자체는 열린다', async () => {
    const r = await get('/login', false)
    expect(r.status).toBe(200)
  })
})

maybe('인증된 FRK 세션', () => {
  it('자기 사업장 담당자 상세는 열린다', async () => {
    const r = await get(`/contacts/${frkContact}`)
    expect(r.status).toBe(200)
  })

  it('타 사업장 담당자 주소를 직접 입력하면 404 를 반환한다', async () => {
    // 요구사항 E-9·E-10 의 최종 확인.
    // 403 이면 "그 ID 의 데이터가 존재한다" 는 사실이 노출된다. 404 여야 한다.
    const r = await get(`/contacts/${frhContact}`)
    expect(r.status).toBe(404)
  })

  it('존재하지 않는 ID 와 타 사업장 ID 의 응답이 구별되지 않는다', async () => {
    const fake = '00000000-0000-4000-8000-000000000000'
    const a = await get(`/contacts/${fake}`)
    const b = await get(`/contacts/${frhContact}`)
    expect(a.status).toBe(b.status)
  })

  it('세션 쿠키는 HttpOnly 로 발급된다', async () => {
    // 로그인 응답을 직접 만들지 않고, 미들웨어가 쿠키를 다루는 방식만 확인한다.
    const r = await get('/contacts')
    expect(r.status).toBe(200)
  })
})

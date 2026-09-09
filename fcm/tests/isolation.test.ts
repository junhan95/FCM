import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { getOwnerDb, getAppPool, closePools } from '@/db'
import { withSite } from '@/lib/tenancy'

/**
 * 사업장 격리 테스트.
 *
 * 이 파일이 통과하지 못하면 병합할 수 없다.
 *
 * 격리는 조용히 깨지는 종류의 기능이다. 화면은 멀쩡히 뜨고 에러도 나지 않으면서
 * 남의 사업장 데이터가 섞여 나온다. 사람의 주의력으로는 지켜지지 않으므로
 * 여기에 고정해 둔다.
 *
 * 문서: docs/05-인증접근제어.md §4~5, docs/07-기술스택.md §3
 */

let FRH: string
let FRK: string
let frhContactId: string
let frkContactId: string

beforeAll(async () => {
  const db = getOwnerDb()
  const sites = await db.execute(sql`select id, code from site`)
  const map = Object.fromEntries(
    (sites.rows as { id: string; code: string }[]).map((r) => [r.code, r.id]),
  )
  FRH = map['FRH']!
  FRK = map['FRK']!

  // 각 사업장의 contact id 를 소유자 컨텍스트에서 확보한다.
  frhContactId = await withOwnerSite(FRH)
  frkContactId = await withOwnerSite(FRK)

  async function withOwnerSite(siteId: string): Promise<string> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.site_id', ${siteId}, true)`)
      const r = await tx.execute(sql`select id from contact limit 1`)
      return (r.rows[0] as { id: string }).id
    })
  }
})

afterAll(async () => {
  await closePools()
})

describe('전제 조건 — 격리가 성립하기 위한 DB 구성', () => {
  it('애플리케이션 롤은 슈퍼유저가 아니며 RLS 우회 권한이 없다', async () => {
    // 슈퍼유저와 BYPASSRLS 롤은 정책을 항상 무시한다.
    // 운영에서 이 값이 true 가 되면 다른 모든 테스트가 무의미해진다.
    const r = await getOwnerDb().execute(sql`
      select rolsuper, rolbypassrls from pg_roles where rolname = 'fcm_app'
    `)
    expect(r.rows[0]).toMatchObject({ rolsuper: false, rolbypassrls: false })
  })

  it('애플리케이션 롤은 테이블 소유자가 아니다', async () => {
    const r = await getOwnerDb().execute(sql`
      select tableowner from pg_tables where tablename = 'contact'
    `)
    expect((r.rows[0] as { tableowner: string }).tableowner).not.toBe('fcm_app')
  })

  it('격리 대상 테이블에 FORCE ROW LEVEL SECURITY 가 켜져 있다', async () => {
    // FORCE 가 없으면 소유자는 정책을 무시한다. ENABLE 만으로는 부족하다.
    const r = await getOwnerDb().execute(sql`
      select relname, relrowsecurity, relforcerowsecurity
      from pg_class
      where relname in ('contact', 'company', 'audit_log')
      order by relname
    `)
    expect(r.rows).toHaveLength(3)
    for (const row of r.rows as any[]) {
      expect(row.relrowsecurity, `${row.relname}: RLS 미활성`).toBe(true)
      expect(row.relforcerowsecurity, `${row.relname}: FORCE 미설정`).toBe(true)
    }
  })
})

describe('조회 격리', () => {
  it('세션 사업장의 데이터만 조회된다', async () => {
    const rows = await withSite(FRH, async (tx) => {
      const r = await tx.execute(sql`select site_id from contact`)
      return r.rows as { site_id: string }[]
    })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.site_id === FRH)).toBe(true)
  })

  it('타 사업장 레코드를 ID로 직접 지정해도 조회되지 않는다', async () => {
    // 요구사항 E-9 의 핵심 시나리오 — 주소창에 /contacts/<uuid> 를 직접 입력하는 경우.
    // 조회 후 소속을 검사하는 것이 아니라, 조회 자체에 사업장 조건이 포함되어야 한다.
    const rows = await withSite(FRK, async (tx) => {
      const r = await tx.execute(sql`select id from contact where id = ${frhContactId}`)
      return r.rows
    })
    expect(rows).toHaveLength(0)
  })

  it('COUNT 집계도 자기 사업장만 센다', async () => {
    // 절대 건수에 의존하지 않는다 — 다른 테스트가 데이터를 추가할 수 있다.
    const perSite = await countPerSite()
    const sum = Object.values(perSite).reduce((a, b) => a + b, 0)

    expect(perSite['FRK']).toBeGreaterThan(0)
    // 한 사업장의 집계는 전체 합보다 작아야 한다. 같다면 격리가 안 된 것이다.
    expect(perSite['FRK']!).toBeLessThan(sum)

    // 그리고 실제 행 수와 집계가 일치해야 한다.
    const rows = await withSite(FRK, async (tx) => {
      const r = await tx.execute(sql`select id from contact`)
      return r.rows.length
    })
    expect(rows).toBe(perSite['FRK'])
  })

  it('컨텍스트 없이는 소유자도 집계할 수 없다', async () => {
    // FORCE ROW LEVEL SECURITY 가 소유자에게도 적용된다는 확인.
    await expect(
      getOwnerDb().execute(sql`select count(*)::int as n from contact`),
    ).rejects.toThrow()
  })
})

async function countPerSite(): Promise<Record<string, number>> {
  const db = getOwnerDb()
  const sites = await db.execute(sql`select id, code from site`)
  const out: Record<string, number> = {}
  for (const s of sites.rows as { id: string; code: string }[]) {
    out[s.code] = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.site_id', ${s.id}, true)`)
      const r = await tx.execute(sql`select count(*)::int as n from contact`)
      return (r.rows[0] as { n: number }).n
    })
  }
  return out
}

describe('fail-closed — 사업장 컨텍스트가 없으면 통과시키지 않는다', () => {
  it('app.site_id 미설정 상태의 조회는 명시적 예외를 던진다', async () => {
    // 0건 반환이 아니라 예외여야 한다. 조용한 0건은 "데이터가 없네" 로 위장된다.
    const client = await getAppPool().connect()
    try {
      await expect(client.query('select * from contact')).rejects.toThrow(
        /app\.site_id 가 설정되지 않았습니다/,
      )
    } finally {
      client.release()
    }
  })

  it('트랜잭션이 끝나면 사업장 설정이 남지 않는다', async () => {
    // set_config(..., is_local=true) 검증.
    // 세션 범위로 설정하면 커넥션 풀 반환 후에도 값이 남아,
    // 다음 요청이 이전 사용자의 사업장으로 조회된다.
    const pool = getAppPool()
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(`select set_config('app.site_id', $1, true)`, [FRH])
      const inside = await client.query(`select current_setting('app.site_id') as v`)
      expect(inside.rows[0].v).toBe(FRH)
      await client.query('commit')

      // 같은 커넥션에서 트랜잭션 밖 — 값이 남아 있지 않아야 한다.
      // PostgreSQL 은 파라미터를 제거하지 않고 '' 로 되돌린다.
      const after = await client.query(`select current_setting('app.site_id', true) as v`)
      expect(after.rows[0].v === '' || after.rows[0].v === null).toBe(true)

      // 그리고 그 상태에서 데이터 접근은 막혀야 한다.
      // 이것이 커넥션 풀 누수를 막는 실질 조건이다.
      await expect(client.query('select * from contact')).rejects.toThrow(
        /app\.site_id 가 설정되지 않았습니다/,
      )
    } finally {
      client.release()
    }
  })
})

describe('쓰기 격리', () => {
  it('타 사업장 site_id 로 INSERT 할 수 없다', async () => {
    // WITH CHECK 절 검증. USING 만 있으면 읽기는 막히지만 쓰기는 뚫린다.
    let caught: unknown
    try {
      await withSite(FRK, async (tx) => {
        await tx.execute(sql`
          insert into contact (site_id, name) values (${FRH}, 'injected')
        `)
      })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeDefined()
    // Drizzle 이 원인 오류를 감싸므로 cause 까지 확인한다.
    const chain = [
      (caught as Error)?.message,
      ((caught as { cause?: Error })?.cause)?.message,
    ].join(' | ')
    expect(chain).toMatch(/row-level security/i)

    // 그리고 실제로 들어가지 않았는지 대상 사업장에서 확인한다.
    const injected = await withSite(FRH, async (tx) => {
      const r = await tx.execute(sql`select id from contact where name = 'injected'`)
      return r.rows.length
    })
    expect(injected).toBe(0)
  })

  it('타 사업장 레코드를 UPDATE 할 수 없다', async () => {
    const affected = await withSite(FRK, async (tx) => {
      const r = await tx.execute(sql`
        update contact set name = 'hijacked' where id = ${frhContactId}
      `)
      return r.rowCount
    })
    expect(affected).toBe(0)

    // 실제로 변경되지 않았는지 원 사업장에서 확인한다.
    const name = await withSite(FRH, async (tx) => {
      const r = await tx.execute(sql`select name from contact where id = ${frhContactId}`)
      return (r.rows[0] as { name: string }).name
    })
    expect(name).not.toBe('hijacked')
  })

  it('타 사업장 레코드를 DELETE 할 수 없다', async () => {
    const affected = await withSite(FRK, async (tx) => {
      const r = await tx.execute(sql`delete from contact where id = ${frhContactId}`)
      return r.rowCount
    })
    expect(affected).toBe(0)

    const still = await withSite(FRH, async (tx) => {
      const r = await tx.execute(sql`select id from contact where id = ${frhContactId}`)
      return r.rows.length
    })
    expect(still).toBe(1)
  })
})

describe('완전 격리의 귀결', () => {
  it('동일 이메일이 여러 사업장에 공존할 수 있다', async () => {
    // 사업장 간 중복은 구조상 수용하기로 확정했다 (docs/04 §4-6).
    // UNIQUE 는 (site_id, email_normalized) 복합이므로 이것이 정상 동작이다.
    const seen: string[] = []
    for (const siteId of [FRH, FRK]) {
      const r = await withSite(siteId, async (tx) => {
        const res = await tx.execute(sql`
          select id from contact where email_normalized = 'shared.contact@example.com'
        `)
        return res.rows as { id: string }[]
      })
      expect(r).toHaveLength(1)
      seen.push(r[0]!.id)
    }
    // 서로 다른 레코드다 — 같은 사람이라도 사업장별로 독립 관리된다.
    expect(seen[0]).not.toBe(seen[1])
  })
})

describe('감사 로그', () => {
  it('사업장 경계를 넘는 기록도 남길 수 있다', async () => {
    // 우회 접근을 기록하는 것이 목적이므로 쓰기까지 격리하면 안 된다.
    // System Admin 이 FRK 세션에서 FRH 데이터를 조회한 상황을 모사한다.
    await withSite(FRK, async (tx) => {
      await tx.execute(sql`
        insert into audit_log (actor_site_id, target_site_id, action, entity_type)
        values (${FRK}, ${FRH}, 'cross_site_view', 'contact')
      `)
    })

    // 기록은 대상 사업장(FRH)에서 읽힌다 — 감시 대상이 자기 데이터의 접근을 본다.
    const visible = await withSite(FRH, async (tx) => {
      const r = await tx.execute(sql`
        select actor_site_id, target_site_id from audit_log
        where action = 'cross_site_view'
      `)
      return r.rows as { actor_site_id: string; target_site_id: string }[]
    })
    expect(visible.length).toBeGreaterThan(0)
    // 이 조건이 격리 우회 접근을 식별한다. actor_site_id 가 NULL 이면
    // SQL 에서 NULL <> x 가 참이 아니라 NULL 이 되어 탐지가 무력화된다.
    expect(visible.every((r) => r.actor_site_id !== r.target_site_id)).toBe(true)
  })

  it('타 사업장을 대상으로 한 기록은 읽히지 않는다', async () => {
    const fromFrk = await withSite(FRK, async (tx) => {
      const r = await tx.execute(sql`
        select id from audit_log where action = 'cross_site_view'
      `)
      return r.rows
    })
    // 위 테스트가 남긴 기록의 target 은 FRH 이므로 FRK 에서는 보이지 않는다.
    expect(fromFrk).toHaveLength(0)
  })

  it('감사 로그는 수정·삭제할 수 없다 (append-only)', async () => {
    const updated = await withSite(FRH, async (tx) => {
      const r = await tx.execute(sql`
        update audit_log set action = 'view' where action = 'cross_site_view'
      `)
      return r.rowCount
    })
    expect(updated).toBe(0)

    const deleted = await withSite(FRH, async (tx) => {
      const r = await tx.execute(sql`delete from audit_log`)
      return r.rowCount
    })
    expect(deleted).toBe(0)
  })
})

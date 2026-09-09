import { sql } from 'drizzle-orm'
import { getAppDb } from '@/db'
import type { PgTransaction } from 'drizzle-orm/pg-core'

/**
 * 사업장 컨텍스트 안에서 DB 작업을 수행한다.
 * 애플리케이션의 모든 데이터 접근은 이 함수를 거쳐야 한다.
 *
 * siteId 는 세션에서 오며, 요청 파라미터에서 오지 않는다.
 * 파라미터로 받으면 조작 가능해진다.
 *
 * set_config 의 세 번째 인자 is_local=true 는 SET LOCAL 과 동일하게
 * 트랜잭션 범위로 한정한다. 이것이 없으면(=SET, 세션 범위) 커넥션 풀에서
 * 커넥션이 반환될 때 값이 남고, 다음 요청이 그 커넥션을 받으면
 * 이전 사용자의 사업장으로 조회된다 — 하필 타 사업장 데이터가 보이는
 * 방향으로 실패한다.
 *
 * SET LOCAL 대신 set_config 를 쓰는 이유는 SET LOCAL 이 파라미터 바인딩을
 * 지원하지 않기 때문이다. 문자열 결합으로 만들면 SQL 인젝션 경로가 된다.
 *
 * 문서: docs/07-기술스택.md §3
 */
export async function withSite<T>(
  siteId: string,
  fn: (tx: PgTransaction<any, any, any>) => Promise<T>,
): Promise<T> {
  const db = getAppDb()
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.site_id', ${siteId}, true)`)
    return fn(tx as PgTransaction<any, any, any>)
  })
}

import { Pool, QueryResultRow } from "pg";

/**
 * PostgreSQL 연결 풀 (전역 싱글턴 — Next.js 개발 모드의 핫리로드에서도 재사용)
 */
declare global {
  var __fctPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__fctPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다 (.env 파일 확인)");
    global.__fctPool = new Pool({ connectionString: url, max: 10 });
  }
  return global.__fctPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

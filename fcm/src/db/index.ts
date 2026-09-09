import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. .env.example 을 참고하십시오.`)
  return v
}

/**
 * 애플리케이션 런타임 연결. 비소유 롤(fcm_app)이며 RLS 가 적용된다.
 * 이 풀을 owner/superuser 자격증명으로 바꾸면 격리가 무력화된다.
 */
let appPool: Pool | undefined
export function getAppPool(): Pool {
  appPool ??= new Pool({ connectionString: required('DATABASE_URL_APP'), max: 10 })
  return appPool
}
export function getAppDb() {
  return drizzle(getAppPool(), { schema })
}

/** 마이그레이션·시드 전용. 요청 처리에 사용하지 않는다. */
let ownerPool: Pool | undefined
export function getOwnerPool(): Pool {
  ownerPool ??= new Pool({ connectionString: required('DATABASE_URL_OWNER'), max: 4 })
  return ownerPool
}
export function getOwnerDb() {
  return drizzle(getOwnerPool(), { schema })
}

export async function closePools(): Promise<void> {
  await Promise.all([appPool?.end(), ownerPool?.end()])
  appPool = undefined
  ownerPool = undefined
}

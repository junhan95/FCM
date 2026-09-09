import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

const here = dirname(fileURLToPath(import.meta.url))

async function runSqlFile(connectionString: string, file: string, label: string) {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query(readFileSync(resolve(here, 'sql', file), 'utf8'))
    console.log(`  ✓ ${label}`)
  } finally {
    await client.end()
  }
}

async function main() {
  console.log('▸ 부트스트랩 (슈퍼유저) — 롤 생성, 스키마 소유권 이전')
  await runSqlFile(process.env.DATABASE_URL_SUPER!, '00_bootstrap.sql', '00_bootstrap.sql')

  console.log('▸ 마이그레이션 (fcm_owner)')
  const client = new Client({ connectionString: process.env.DATABASE_URL_OWNER! })
  await client.connect()
  try {
    await migrate(drizzle(client), { migrationsFolder: resolve(here, 'migrations') })
    console.log('  ✓ 스키마 적용')
  } finally {
    await client.end()
  }

  console.log('▸ RLS 정책 (fcm_owner)')
  await runSqlFile(process.env.DATABASE_URL_OWNER!, '10_rls.sql', '10_rls.sql')

  console.log('완료')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

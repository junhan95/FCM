import { pgTable, uuid, text, boolean, pgEnum } from 'drizzle-orm/pg-core'

/**
 * 관할 코드. 발송 규칙(제목 (광고) 접두, 동의 만료 주기 등)이 여기서 파생된다.
 * 문서: docs/06-관할별법령대응.md §3-2
 */
export const jurisdictionEnum = pgEnum('jurisdiction', ['eu_de', 'cn', 'kr', 'in'])

/**
 * 사업장. 격리의 기준 단위이며, 로그인 화면의 드롭다운도 이 테이블에서 생성된다.
 * 사업장 코드를 애플리케이션에 하드코딩하지 않는다.
 */
export const site = pgTable('site', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  city: text('city'),
  country: text('country').notNull(),
  jurisdiction: jurisdictionEnum('jurisdiction').notNull(),
  defaultLanguage: text('default_language').notNull().default('en'),
  isActive: boolean('is_active').notNull().default(true),
})

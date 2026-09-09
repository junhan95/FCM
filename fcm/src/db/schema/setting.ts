import { pgTable, text, boolean, timestamp, uuid, customType } from 'drizzle-orm/pg-core'
import { appUser } from './user'

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType: () => 'bytea',
})

/**
 * 시스템 설정. sales@frankoniagroup.com 의 OAuth 클라이언트 시크릿과
 * 리프레시 토큰이 여기 들어간다 — 전 사업장 발송 권한을 가진 자격증명이므로
 * 이 시스템에서 가장 민감한 값이다.
 *
 * - 평문 저장 금지. 암호화 키는 DB 가 아닌 환경변수에 둔다
 *   (DB 백업이 유출돼도 토큰이 함께 새지 않도록)
 * - is_secret 인 값은 어떤 API 로도 되읽을 수 없어야 한다. 설정 여부만 노출한다
 *
 * 문서: docs/03-데이터모델초안.md §5-A
 */
export const systemSetting = pgTable('system_setting', {
  key: text('key').primaryKey(),
  value: text('value'),
  valueEncrypted: bytea('value_encrypted'),
  isSecret: boolean('is_secret').notNull().default(false),
  updatedBy: uuid('updated_by').references(() => appUser.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

import { pgTable, uuid, text, integer, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { site } from './site'
import { appUser } from './user'

export const importStatusEnum = pgEnum('import_status', [
  'processing', 'completed', 'failed', 'reverted',
])

/**
 * 업로드 이력. 되돌리기(A-9)를 하려면 이 배치로 생성된 contact 를 역추적할 수
 * 있어야 하며, contact.import_batch_id 가 그 경로다.
 * 문서: docs/03-데이터모델초안.md §5-A
 */
export const importBatch = pgTable('import_batch', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => site.id),
  filename: text('filename').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => appUser.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  /** 원본 컬럼 → 시스템 필드 매핑 결과 (A-2) */
  columnMapping: jsonb('column_mapping'),
  rowCountTotal: integer('row_count_total').notNull().default(0),
  rowCountCreated: integer('row_count_created').notNull().default(0),
  rowCountDuplicate: integer('row_count_duplicate').notNull().default(0),
  rowCountError: integer('row_count_error').notNull().default(0),
  errorDetail: jsonb('error_detail'),
  status: importStatusEnum('status').notNull().default('processing'),
})

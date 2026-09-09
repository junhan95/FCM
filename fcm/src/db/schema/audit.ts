import { pgTable, uuid, text, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import { site } from './site'
import { appUser } from './user'

export const auditActionEnum = pgEnum('audit_action', [
  'view', 'create', 'update', 'delete', 'export', 'send',
  'login', 'login_failed', 'logout',
  'permission_change', 'cross_site_view', 'admin_console_enter',
])

/**
 * 감사 로그. 원칙 6(격리 테이블은 site_id 직접 보유)의 유일한 예외로,
 * 사업장 경계를 넘는 행위를 기록하는 것이 목적이므로 두 개의 사업장 컬럼을 갖는다.
 *
 * actor_site_id 는 "소속"이 아니라 "행위 시점 세션의 활성 사업장"이며 NOT NULL 이다.
 * NULL 이면 `actor_site_id <> target_site_id` 가 참이 아니라 NULL 로 평가되어
 * 격리 우회 접근이 탐지 필터에 잡히지 않는다.
 *
 * 문서: docs/03-데이터모델초안.md §5-A, docs/04-사이트권한구조.md §5
 */
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id').references(() => appUser.id),
  actorSiteId: uuid('actor_site_id').notNull().references(() => site.id),
  targetSiteId: uuid('target_site_id').notNull().references(() => site.id),
  action: auditActionEnum('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  detail: jsonb('detail'),
  ipAddress: text('ip_address'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_audit_target_site').on(t.targetSiteId, t.occurredAt),
  // 격리 우회 접근 탐지용
  index('idx_audit_actor_site').on(t.actorSiteId, t.occurredAt),
])

import {
  pgTable, uuid, text, boolean, integer, timestamp, pgEnum, uniqueIndex, index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { site } from './site'

/** 사업장 내 역할. System Admin 은 사업장에 종속되지 않으므로 여기 없다. */
export const siteRoleEnum = pgEnum('site_role', ['staff', 'site_admin'])

/**
 * 사용자 신원.
 * site_id 와 role 이 여기 없는 것은 의도적이다 — 겸직이 가능하므로 소속과 역할은
 * 사업장별로 달라진다. user_site_membership 이 그 관계를 담는다.
 * 문서: docs/03-데이터모델초안.md §3
 */
export const appUser = pgTable('app_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  loginId: text('login_id').notNull().unique(),
  email: text('email'),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash'),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  /** 전사 권한. 사업장에 종속되지 않는다. */
  isSystemAdmin: boolean('is_system_admin').notNull().default(false),
  /** 퇴사 시 false. 삭제하지 않는다 — 감사 로그·발송 이력의 행위자 참조가 끊긴다. */
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * 사업장별 권한 부여. 로그인 3단계 검증의 마지막 관문이다.
 * ID/PW 가 맞아도 선택한 사업장에 활성 멤버십이 없으면 로그인 실패.
 * 문서: docs/05-인증접근제어.md §2-3
 */
export const userSiteMembership = pgTable('user_site_membership', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => appUser.id),
  siteId: uuid('site_id').notNull().references(() => site.id),
  role: siteRoleEnum('role').notNull().default('staff'),
  grantedBy: uuid('granted_by').references(() => appUser.id),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  /** 회수 시각. 레코드를 삭제하지 않고 이력을 보존한다. */
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [
  // 부분 유니크: 전체 유니크로 걸면 회수 후 재부여가 막힌다.
  uniqueIndex('uq_membership_active')
    .on(t.userId, t.siteId)
    .where(sql`${t.revokedAt} is null`),
])

/**
 * 세션. site_id 를 담는 것이 핵심이다.
 * 사업장을 요청 파라미터로 받으면 조작 가능해지므로, 세션이 결정한다.
 * 문서: docs/05-인증접근제어.md §3
 */
export const userSession = pgTable('user_session', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => appUser.id),
  /** 세션 생성 후 변경 불가. 사업장 전환은 재로그인. */
  siteId: uuid('site_id').notNull().references(() => site.id),
  roleSnapshot: siteRoleEnum('role_snapshot').notNull(),
  isSystemAdmin: boolean('is_system_admin').notNull().default(false),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [index('idx_session_user').on(t.userId)])

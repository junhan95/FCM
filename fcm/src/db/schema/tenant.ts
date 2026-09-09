import { pgTable, uuid, text, timestamp, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { site } from './site'
import { appUser } from './user'

/**
 * 고객사. site_id 를 직접 보유한다 — 조인을 거쳐야 소속을 알 수 있는 테이블에는
 * RLS 정책을 걸기 어렵기 때문이다. 문서: docs/03-데이터모델초안.md §1 원칙 6
 */
export const company = pgTable('company', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => site.id),
  name: text('name').notNull(),
  country: text('country'),
  category: text('category'),
  address: text('address'),
  createdBy: uuid('created_by').references(() => appUser.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('idx_company_site').on(t.siteId)])

/**
 * 담당자. 기획안이 말하는 "customer" 단위이며 발송 대상이다.
 * 필수 6개 필드(Name, Email, Company, Category, Language, Country)는 기획안 명시 사항.
 */
export const contact = pgTable('contact', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => site.id),
  companyId: uuid('company_id').references(() => company.id),
  name: text('name').notNull(),
  email: text('email'),
  /** 중복 탐지용 정규화 이메일 (소문자·공백제거) */
  emailNormalized: text('email_normalized'),
  phone: text('phone'),
  position: text('position'),
  department: text('department'),
  category: text('category'),
  /** 메일 본문 언어를 결정한다 */
  language: text('language'),
  /** 적용 법령 판단 근거 */
  country: text('country'),
  /** 이관 데이터는 unknown 으로 초기화한다 (F-15) */
  consentStatus: text('consent_status').notNull().default('unknown'),
  consentExpiresAt: timestamp('consent_expires_at', { withTimezone: true }),
  /** 7일 재발송 경고 판정용 */
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  ownerUserId: uuid('owner_user_id').references(() => appUser.id),
  source: text('source'),
  importBatchId: uuid('import_batch_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_contact_site').on(t.siteId),
  // 사업장 내 이메일 중복 방지. 사업장 간 동일 이메일은 정상이다(완전 격리 확정).
  uniqueIndex('uq_contact_site_email').on(t.siteId, t.emailNormalized),
])

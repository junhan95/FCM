import { sql } from 'drizzle-orm'
import { getAppDb } from '@/db'

type AuditAction =
  | 'view' | 'create' | 'update' | 'delete' | 'export' | 'send'
  | 'login' | 'login_failed' | 'logout'
  | 'permission_change' | 'cross_site_view' | 'admin_console_enter'

/**
 * 감사 기록.
 *
 * actorSiteId 는 "소속"이 아니라 행위 시점 세션의 활성 사업장이며 NOT NULL 이다.
 * NULL 이면 SQL 에서 actor_site_id <> target_site_id 가 참이 아니라 NULL 로
 * 평가되어, 격리 우회 접근이 탐지 필터에 잡히지 않는다.
 *
 * 쓰기는 사업장 격리 대상이 아니다 (RLS 정책 audit_write 는 WITH CHECK (true)).
 * 경계를 넘는 행위를 기록하는 것이 목적이므로 기록까지 격리하면
 * 우회 접근이 기록되지 못한다.
 *
 * 감사 실패가 업무를 막아서는 안 되므로 예외를 삼키되 로그는 남긴다.
 */
export async function recordAudit(entry: {
  actorUserId?: string | null
  actorSiteId: string
  targetSiteId: string
  action: AuditAction
  entityType?: string | null
  entityId?: string | null
  detail?: unknown
  ipAddress?: string | null
}): Promise<void> {
  try {
    await getAppDb().execute(sql`
      insert into audit_log
        (actor_user_id, actor_site_id, target_site_id, action, entity_type, entity_id, detail, ip_address)
      values (
        ${entry.actorUserId ?? null}, ${entry.actorSiteId}, ${entry.targetSiteId},
        ${entry.action}, ${entry.entityType ?? null}, ${entry.entityId ?? null},
        ${entry.detail ? JSON.stringify(entry.detail) : null}::jsonb,
        ${entry.ipAddress ?? null}
      )
    `)
  } catch (e) {
    console.error('[audit] 기록 실패', e)
  }
}

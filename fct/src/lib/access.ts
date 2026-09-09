/**
 * 프로젝트 접근 권한.
 *
 *   ADMIN            — 모든 프로젝트를 보고 고칠 수 있다
 *   생성자           — 자기 프로젝트를 고치고, 다른 계정에 편집 권한을 줄 수 있다
 *   공동 작업자      — 생성자가 추가한 계정. 고칠 수 있지만 권한을 나눠 주지는 못한다
 *   그 밖의 USER     — 열람만 가능 (저장·수정·삭제 불가)
 *
 * 판정 규칙은 이 파일 하나에만 둔다 — 화면과 서버가 같은 답을 내야 한다.
 */
import type { SessionUser } from "./auth";

export interface ProjectAccess {
  canView: boolean;
  /** 값 입력·저장·스냅샷 */
  canEdit: boolean;
  /** 공동 작업자 추가·삭제, 프로젝트 삭제 */
  canManage: boolean;
}

export const READ_ONLY: ProjectAccess = { canView: true, canEdit: false, canManage: false };

export function projectAccess(
  user: Pick<SessionUser, "id" | "role">,
  project: { created_by?: number | null },
  isEditor: boolean,
): ProjectAccess {
  if (user.role === "ADMIN") return { canView: true, canEdit: true, canManage: true };
  if (project.created_by === user.id) return { canView: true, canEdit: true, canManage: true };
  if (isEditor) return { canView: true, canEdit: true, canManage: false };
  return READ_ONLY;
}

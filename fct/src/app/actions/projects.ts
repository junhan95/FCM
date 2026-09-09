"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  addProjectMember,
  audit,
  createProject,
  deleteProject,
  getDefaultTemplate,
  getProject,
  getSnapshot,
  isProjectEditor,
  removeProjectMember,
  saveSnapshot,
  updateProjectMeta,
  updateProjectOverrides,
} from "@/lib/data";
import { projectAccess } from "@/lib/access";
import { Overrides } from "@/engine/types";
import { getLang } from "@/lib/lang";
import { makeT } from "@/lib/i18n";

export async function createProjectAction(formData: FormData) {
  const s = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const tpl = await getDefaultTemplate();
  const id = await createProject(
    {
      name,
      customer: String(formData.get("customer") ?? ""),
      country: String(formData.get("country") ?? ""),
      quotationNo: String(formData.get("quotationNo") ?? ""),
      revision: String(formData.get("revision") ?? ""),
      editor: String(formData.get("editor") ?? (s.name || s.username)),
      templateId: tpl.id,
    },
    s.id,
  );
  await audit(s.id, "CREATE_PROJECT", String(id), { name });
  redirect(`/projects/${id}`);
}

/** 엑셀에서 읽은 입력값으로 프로젝트 생성 */
export async function createProjectFromImportAction(f: {
  name: string;
  customer?: string;
  country?: string;
  quotationNo?: string;
  revision?: string;
  overrides: Overrides;
}) {
  const s = await requireSession();
  const name = f.name.trim();
  if (!name) return;
  const tpl = await getDefaultTemplate();
  // 값 정제 — 좌표 형식과 스칼라 타입만 허용
  const clean: Overrides = {};
  for (const [sheet, cells] of Object.entries(f.overrides ?? {})) {
    if (typeof cells !== "object" || !cells) continue;
    const out: Record<string, number | string> = {};
    for (const [coord, v] of Object.entries(cells)) {
      if (!/^[A-Z]{1,3}\d{1,7}$/.test(coord)) continue;
      if (typeof v === "number" && Number.isFinite(v)) out[coord] = v;
      else if (typeof v === "string" && v.length <= 2000) out[coord] = v;
    }
    if (Object.keys(out).length) clean[sheet] = out;
  }
  const id = await createProject(
    {
      name,
      customer: f.customer ?? "",
      country: f.country ?? "",
      quotationNo: f.quotationNo ?? "",
      revision: f.revision ?? "",
      editor: s.name || s.username,
      templateId: tpl.id,
      overrides: clean,
    },
    s.id,
  );
  await audit(s.id, "IMPORT_PROJECT", String(id), { name, cells: Object.values(clean).reduce((n, c) => n + Object.keys(c).length, 0) });
  redirect(`/projects/${id}`);
}

/**
 * 이 세션이 프로젝트를 고칠 수 있는지 확인하고 프로젝트를 돌려준다.
 * 화면에서 버튼을 숨기는 것과 별개로, 서버에서 한 번 더 막는다.
 */
async function requireEdit(id: number, manage = false) {
  const s = await requireSession();
  const t = makeT(await getLang());
  const p = await getProject(id);
  if (!p) throw new Error(t("projectNotFound"));
  const a = projectAccess(s, p, await isProjectEditor(id, s.id));
  if (manage ? !a.canManage : !a.canEdit) throw new Error(t("editDenied"));
  return { s, p, a };
}

export async function updateProjectMetaAction(id: number, formData: FormData) {
  const { s } = await requireEdit(id);
  await updateProjectMeta(id, {
    name: String(formData.get("name") ?? ""),
    customer: String(formData.get("customer") ?? ""),
    country: String(formData.get("country") ?? ""),
    quotationNo: String(formData.get("quotationNo") ?? ""),
    revision: String(formData.get("revision") ?? ""),
    editor: String(formData.get("editor") ?? ""),
    status: String(formData.get("status") ?? "DRAFT"),
    notes: String(formData.get("notes") ?? ""),
  });
  await audit(s.id, "UPDATE_PROJECT", String(id));
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
}

export async function deleteProjectAction(id: number) {
  const { s, p } = await requireEdit(id, true);
  await deleteProject(id);
  await audit(s.id, "DELETE_PROJECT", String(id), { name: p.name });
  revalidatePath("/");
}

export async function duplicateProjectAction(id: number) {
  const s = await requireSession();
  const p = await getProject(id);
  if (!p) return;
  const nid = await createProject(
    {
      name: p.name + " (copy)",
      customer: p.customer,
      country: p.country,
      quotationNo: p.quotation_no,
      revision: p.revision,
      editor: p.editor,
      templateId: p.template_id,
      overrides: p.overrides,
    },
    s.id,
  );
  await audit(s.id, "DUPLICATE_PROJECT", String(nid), { from: id });
  redirect(`/projects/${nid}`);
}

export async function saveSnapshotAction(id: number, label: string, summary: unknown) {
  const { s, p } = await requireEdit(id);
  await saveSnapshot(id, label, p.overrides, summary, s.id);
  revalidatePath(`/projects/${id}`);
}

export async function restoreSnapshotAction(projectId: number, snapshotId: number) {
  const { s } = await requireEdit(projectId);
  const snap = await getSnapshot(snapshotId);
  if (!snap || snap.project_id !== projectId) return;
  await updateProjectOverrides(projectId, snap.overrides as Overrides);
  await audit(s.id, "RESTORE_SNAPSHOT", String(projectId), { snapshotId });
  revalidatePath(`/projects/${projectId}`);
}

// ---------- 공동 작업자 ----------
export async function addProjectMemberAction(projectId: number, userId: number) {
  const { s } = await requireEdit(projectId, true);
  await addProjectMember(projectId, userId, s.id);
  await audit(s.id, "ADD_MEMBER", String(projectId), { userId });
  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectMemberAction(projectId: number, userId: number) {
  const { s } = await requireEdit(projectId, true);
  await removeProjectMember(projectId, userId);
  await audit(s.id, "REMOVE_MEMBER", String(projectId), { userId });
  revalidatePath(`/projects/${projectId}`);
}

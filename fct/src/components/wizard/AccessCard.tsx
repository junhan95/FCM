"use client";

import { useState } from "react";
import { useProject } from "../ProjectStore";
import { addProjectMemberAction, removeProjectMemberAction } from "@/app/actions/projects";
import type { ProjectMember } from "@/lib/data";

/**
 * 프로젝트 접근 권한 — 생성자(와 관리자)만 본다.
 * 여기에 추가한 계정은 이 프로젝트를 편집할 수 있고, 그 밖의 USER 는 열람만 가능하다.
 */
export default function AccessCard({
  ownerName,
  members,
  users,
}: {
  ownerName: string;
  members: ProjectMember[];
  users: { id: number; username: string; name: string; role: string }[];
}) {
  const { t, projectId } = useProject();
  const [busy, setBusy] = useState(false);
  const taken = new Set(members.map((m) => m.user_id));
  const addable = users.filter((u) => !taken.has(u.id));

  return (
    <section className="card panel p-4">
      <div className="mb-1 flex flex-wrap items-baseline gap-3">
        <h2 className="card-title">{t("access")}</h2>
        <span className="card-sub">{t("accessHint")}</span>
      </div>

      <table className="tbl tbl-fixed mt-2 w-full">
        <colgroup>
          <col />
          <col style={{ width: "120px" }} />
          <col style={{ width: "110px" }} />
        </colgroup>
        <tbody>
          <tr>
            <td className="text-[13px] font-semibold text-slate-900">{ownerName}</td>
            <td>
              <span className="badge bg-red-50 text-brand">{t("accessOwner")}</span>
            </td>
            <td></td>
          </tr>
          {members.map((m) => (
            <tr key={m.user_id}>
              <td className="text-[13px] text-slate-800">
                {m.name || m.username}
                <span className="ml-2 text-[11px] text-slate-400">{m.username}</span>
              </td>
              <td>
                <span className="badge bg-sky-50 text-sky-700">{t("accessEditor")}</span>
              </td>
              <td className="text-right">
                <button
                  type="button"
                  className="text-[12px] text-slate-400 hover:text-brand hover:underline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await removeProjectMemberAction(projectId, m.user_id);
                    setBusy(false);
                  }}
                >
                  {t("accessRemove")}
                </button>
              </td>
            </tr>
          ))}
          {members.length === 0 && (
            <tr>
              <td colSpan={3} className="py-2 text-[12px] text-slate-500">
                {t("accessNone")}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {addable.length > 0 && (
        <label className="mt-3 block">
          <span className="mb-0.5 block text-[11px] text-slate-500">{t("accessAdd")}</span>
          <select
            className="field !w-72"
            value=""
            disabled={busy}
            onChange={async (e) => {
              if (!e.target.value) return;
              setBusy(true);
              await addProjectMemberAction(projectId, Number(e.target.value));
              setBusy(false);
            }}
          >
            <option value="">— {t("accessAdd")} —</option>
            {addable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ? `${u.name} (${u.username})` : u.username}
                {u.role === "ADMIN" ? " · ADMIN" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

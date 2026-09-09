"use client";

import { useState } from "react";
import { ProjectRecord } from "@/lib/data";
import { Lang, makeT } from "@/lib/i18n";
import { duplicateProjectAction, restoreSnapshotAction, saveSnapshotAction, updateProjectMetaAction } from "@/app/actions/projects";
import DeleteProjectDialog from "@/components/DeleteProjectDialog";
import { useProject } from "@/components/ProjectStore";
import { fmtEur } from "@/lib/format";

const STATUSES = ["DRAFT", "OFFERED", "ORDERED", "LOST", "ARCHIVED"];

export default function ProjectMeta({
  project,
  snapshots,
  canDelete,
  lang,
}: {
  project: ProjectRecord;
  snapshots: { id: number; label: string; summary: unknown; created_at: string; username: string | null }[];
  canDelete: boolean;
  lang: Lang;
}) {
  const t = makeT(lang);
  const { wb, saveNow } = useProject();
  const [label, setLabel] = useState("");
  const update = updateProjectMetaAction.bind(null, project.id);

  return (
    <aside className="space-y-4">
      <section className="card p-3">
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("editMeta")}</h2>
        <form action={update} className="space-y-2 text-[12px]">
          {(
            [
              ["name", "projectName"],
              ["customer", "customer"],
              ["country", "country"],
              ["quotationNo", "quotationNo"],
              ["revision", "revision"],
              ["editor", "editor"],
            ] as const
          ).map(([k, lk]) => (
            <label key={k} className="block">
              <span className="text-slate-600">{t(lk)}</span>
              <input
                name={k}
                className="field mt-0.5"
                defaultValue={
                  k === "quotationNo" ? project.quotation_no : (project as unknown as Record<string, string>)[k] ?? ""
                }
              />
            </label>
          ))}
          <label className="block">
            <span className="text-slate-600">{t("status")}</span>
            <select name="status" className="field mt-0.5" defaultValue={project.status}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-slate-600">{t("notes")}</span>
            <textarea name="notes" className="field mt-0.5" rows={3} defaultValue={project.notes} />
          </label>
          <div className="flex gap-2">
            <button className="btn">{t("save")}</button>
            <button type="button" className="btn-secondary" onClick={() => duplicateProjectAction(project.id)}>
              Copy
            </button>
            {canDelete && (
              <span className="ml-auto">
                <DeleteProjectDialog projectId={project.id} projectName={project.name} lang={lang} afterDelete="/" />
              </span>
            )}
          </div>
        </form>
        <div className="mt-2 text-[11px] text-slate-500">
          {t("createdBy")}: {project.created_by_name ?? "-"} · {t("updatedAt")}: {new Date(project.updated_at).toLocaleString()}
        </div>
      </section>

      <section className="card p-3">
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("snapshots")}</h2>
        <div className="mb-2 flex gap-2">
          <input className="field" placeholder="label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button
            type="button"
            className="btn-secondary whitespace-nowrap"
            onClick={async () => {
              await saveNow();
              const summary = wb
                ? { finalEur: wb.get("Total", "AE66"), materialSales: wb.get("Total", "F64"), installSales: wb.get("Total", "V64") }
                : null;
              await saveSnapshotAction(project.id, label || new Date().toLocaleString(), summary);
              setLabel("");
            }}
          >
            {t("snapshot")}
          </button>
        </div>
        <ul className="space-y-1 text-[12px]">
          {snapshots.map((s) => {
            const sum = s.summary as { finalEur?: number } | null;
            return (
              <li key={s.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1">
                <span>
                  <b>{s.label}</b>
                  <span className="ml-1 text-slate-500">
                    {new Date(s.created_at).toLocaleString()} · {s.username ?? ""}
                  </span>
                  {sum?.finalEur !== undefined && <span className="ml-2 tabular-nums text-emerald-800">{fmtEur(sum.finalEur)}</span>}
                </span>
                <button
                  type="button"
                  className="text-sky-700 hover:underline"
                  onClick={async () => {
                    if (!confirm(t("restore") + "?")) return;
                    await restoreSnapshotAction(project.id, s.id);
                    location.reload();
                  }}
                >
                  {t("restore")}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}

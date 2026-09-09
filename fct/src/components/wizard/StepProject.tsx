"use client";

import { useState } from "react";
import { useProject } from "../ProjectStore";
import { updateProjectMetaAction } from "@/app/actions/projects";
import type { ProjectRecord } from "@/lib/data";

const STATUSES = ["DRAFT", "OFFERED", "ORDERED", "LOST", "ARCHIVED"];

export default function StepProject({ project, accessCard }: { project: ProjectRecord; accessCard?: React.ReactNode }) {
  const { t, canEdit } = useProject();
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-4">
      <form
        action={async (fd) => {
          await updateProjectMetaAction(project.id, fd);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
        className={`card panel space-y-3 p-4 ${canEdit ? "" : "pointer-events-none opacity-70"}`}
      >
        <h2 className="card-title">{t("customerInfo")}</h2>
        <label className="block text-[12px]">
          <span className="text-slate-600">{t("projectName")} *</span>
          <input name="name" className="field mt-0.5" defaultValue={project.name} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px]">
            <span className="text-slate-600">{t("customer")}</span>
            <input name="customer" className="field mt-0.5" defaultValue={project.customer} />
          </label>
          <label className="block text-[12px]">
            <span className="text-slate-600">{t("country")}</span>
            <input name="country" className="field mt-0.5" defaultValue={project.country} />
          </label>
          <label className="block text-[12px]">
            <span className="text-slate-600">{t("quotationNo")}</span>
            <input name="quotationNo" className="field mt-0.5" defaultValue={project.quotation_no} />
          </label>
          <label className="block text-[12px]">
            <span className="text-slate-600">{t("revision")}</span>
            <input name="revision" className="field mt-0.5" defaultValue={project.revision} />
          </label>
          <label className="block text-[12px]">
            <span className="text-slate-600">{t("editor")}</span>
            <input name="editor" className="field mt-0.5" defaultValue={project.editor} />
          </label>
          <label className="block text-[12px]">
            <span className="text-slate-600">{t("status")}</span>
            <select name="status" className="field mt-0.5" defaultValue={project.status}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-[12px]">
          <span className="text-slate-600">{t("notes")}</span>
          <textarea name="notes" className="field mt-0.5" rows={4} defaultValue={project.notes} placeholder={t("notesHint")} />
        </label>
        <div className={`flex items-center gap-3 ${canEdit ? "" : "hidden"}`}>
          <button className="btn">{t("save")}</button>
          {saved && <span className="text-[12px] text-emerald-700">✓ {t("saved")}</span>}
        </div>
      </form>

      {accessCard}

      <aside className="card panel p-4">
        <h2 className="card-title mb-2">{t("howItWorks")}</h2>
        <ol className="space-y-2 text-[13px] text-slate-600">
          <li>
            <b className="text-slate-800">1. {t("customerInfo")}</b> — {t("guideProject")}
          </li>
          <li>
            <b className="text-slate-800">2. {t("stepChamber")}</b> — {t("guideChamber")}
          </li>
          <li>
            <b className="text-slate-800">3. {t("stepParts")}</b> — {t("guideParts")}
          </li>
          <li>
            <b className="text-slate-800">4. {t("stepResources")}</b> — {t("guideResources")}
          </li>
          <li>
            <b className="text-slate-800">5. {t("stepSummary")}</b> — {t("guideSummary")}
          </li>
        </ol>
        <p className="mt-4 border-t border-slate-100 pt-3 text-[12px] text-slate-500">{t("guideAutosave")}</p>
      </aside>
    </div>
  );
}

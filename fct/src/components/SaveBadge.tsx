"use client";

import { useProject } from "./ProjectStore";

export default function SaveBadge() {
  const { saveState, saveNow, t } = useProject();
  const cls =
    saveState === "saved"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : saveState === "saving"
        ? "bg-sky-50 text-sky-700 border-sky-200"
        : saveState === "error"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-amber-50 text-amber-700 border-amber-200";
  const label = saveState === "saved" ? t("saved") : saveState === "saving" ? t("saving") : saveState === "error" ? "Error" : t("unsaved");
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
      <button type="button" className="btn-secondary !py-0.5" onClick={() => void saveNow()}>
        {t("save")}
      </button>
    </span>
  );
}

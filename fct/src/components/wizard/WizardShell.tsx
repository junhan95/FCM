"use client";

import { useEffect, useState } from "react";
import { useProject } from "../ProjectStore";
import SaveBadge from "../SaveBadge";
import { fmtEur, fmtUsd } from "@/lib/format";
import { MAIN_CHAMBER_ROWS, STEPS, StepId } from "@/lib/wizard";
import StepProject from "./StepProject";
import StepChamber from "./StepChamber";
import StepParts from "./StepParts";
import StepResources from "./StepResources";
import StepOptions from "./StepOptions";
import RefIssues from "./RefIssues";
import StepSummary from "./StepSummary";
import type { ProjectMember, ProjectRecord } from "@/lib/data";
import type { ProjectAccess } from "@/lib/access";
import AccessCard from "./AccessCard";

const T = "Total";

/** 현재 선택된 메인 챔버 행들 (Total!C{row} > 0) */
export function selectedChamberRows(wb: NonNullable<ReturnType<typeof useProject>["wb"]>): number[] {
  return MAIN_CHAMBER_ROWS.filter((r) => {
    const v = wb.get(T, `C${r}`);
    return typeof v === "number" && v > 0;
  });
}

export default function WizardShell({
  project,
  snapshots,
  canDelete,
  access,
  members,
  users,
}: {
  project: ProjectRecord;
  snapshots: { id: number; label: string; summary: unknown; created_at: string; username: string | null }[];
  canDelete: boolean;
  access: ProjectAccess;
  members: ProjectMember[];
  users: { id: number; username: string; name: string; role: string }[];
}) {
  const { wb, ready, error, t, lang, projectId, version, templateVersion } = useProject();
  const [step, setStep] = useState<StepId>("chamber");
  void version;

  // 마지막으로 보던 단계 복원
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const s = localStorage.getItem(`fct_step_${projectId}`) as StepId | null;
        if (s && STEPS.some((x) => x.id === s)) setStep(s);
      } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, [projectId]);

  const go = (s: StepId) => {
    setStep(s);
    try {
      localStorage.setItem(`fct_step_${projectId}`, s);
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!ready || !wb) return <div className="p-6 text-slate-500">{t("loadingEngine")}</div>;

  const chamberRows = selectedChamberRows(wb);

  const g = (c: string) => wb.get(T, c);
  const idx = STEPS.findIndex((s) => s.id === step);
  const chamberNames = chamberRows.map((r) => String(wb.get(T, `B${r}`) ?? "").trim());

  // USD 환율이 0이면(미입력) USD 카드는 숨긴다
  const fxUsd = g("E68");
  const showUsd = typeof fxUsd === "number" && fxUsd > 0;
  const kpis = [
    { label: t("materialSales"), v: fmtEur(g("F64")) },
    { label: t("installSales"), v: fmtEur(g("V64")) },
    {
      label: t("transport"),
      v: fmtEur(typeof g("Y64") === "number" && typeof g("AA64") === "number" ? (g("Y64") as number) + (g("AA64") as number) : g("Y64")),
    },
    { label: t("netSales"), v: fmtEur(g("AD64")) },
    { label: t("finalEur"), v: fmtEur(g("AE66")), strong: true },
    ...(showUsd ? [{ label: t("pricingDap"), v: fmtUsd(g("AF66")) }] : []),
  ];

  return (
    <div className="shell">
      {/* 헤더 */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="page-title">{project.name}</h1>
        {project.customer && <span className="text-[13px] text-slate-500">{project.customer}</span>}
        {chamberNames.slice(0, 3).map((n) => (
          <span key={n} className="badge bg-red-50 text-brand">
            {n}
          </span>
        ))}
        {chamberNames.length > 3 && <span className="text-[11px] text-slate-500">+{chamberNames.length - 3}</span>}
        <span className="text-[11px] text-slate-400">{templateVersion}</span>
        {!access.canEdit && <span className="badge bg-amber-100 text-amber-800">{t("readOnly")}</span>}
        <div className="ml-auto flex items-center gap-3">
          {access.canEdit && <SaveBadge />}
        </div>
      </div>

      {!access.canEdit && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">{t("readOnlyBanner")}</p>
      )}

      <RefIssues />

      {/* 단계 표시 */}
      <ol className="mb-4 flex flex-wrap items-center gap-1">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < idx;
          return (
            <li key={s.id} className="flex items-center">
              <button
                type="button"
                onClick={() => go(s.id)}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active ? "bg-brand text-white" : done ? "bg-red-50 text-brand hover:bg-red-100" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    active ? "bg-white/25 text-white" : done ? "bg-brand text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                {lang === "ko" ? s.ko : s.en}
              </button>
              {i < STEPS.length - 1 && <span className="px-0.5 text-slate-300">›</span>}
            </li>
          );
        })}
      </ol>

      {/* 실시간 금액 */}
      <section className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className={`card px-3.5 py-2.5 ${k.strong ? "border-brand/40 bg-red-50/60" : ""}`}>
            <div className={`eyebrow ${k.strong ? "text-brand/70" : ""}`}>{k.label}</div>
            <div className={`mt-0.5 text-[17px] font-bold tabular-nums tracking-tight ${k.strong ? "text-brand" : "text-slate-900"}`}>{k.v}</div>
          </div>
        ))}
      </section>

      {/* 본문 */}
      <div className="min-h-[400px]">
        {step === "project" && (
          <StepProject
            project={project}
            accessCard={
              access.canManage ? <AccessCard ownerName={project.created_by_name || "—"} members={members} users={users} /> : undefined
            }
          />
        )}
        {step === "chamber" && <StepChamber onNext={() => go("parts")} />}
        {step === "parts" && <StepParts chamberRows={chamberRows} onPickChamber={() => go("chamber")} />}
        {step === "resources" && <StepResources hasChamber={chamberRows.length > 0} />}
        {step === "options" && <StepOptions />}
        {step === "summary" && <StepSummary project={project} snapshots={snapshots} canDelete={canDelete} />}
      </div>

      {/* 이전/다음 */}
      <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
        {idx > 0 ? (
          <button type="button" className="btn-secondary" onClick={() => go(STEPS[idx - 1].id)}>
            ← {lang === "ko" ? STEPS[idx - 1].ko : STEPS[idx - 1].en}
          </button>
        ) : (
          <span />
        )}
        {idx < STEPS.length - 1 && (
          <button type="button" className="btn" onClick={() => go(STEPS[idx + 1].id)}>
            {lang === "ko" ? STEPS[idx + 1].ko : STEPS[idx + 1].en} →
          </button>
        )}
      </div>
    </div>
  );
}

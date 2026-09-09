"use client";

import React, { useState } from "react";
import { useProject } from "../ProjectStore";
import { fmtEur, fmtUsd, fmtValue } from "@/lib/format";
import { EXTRA_ROWS, MAIN_CHAMBER_ROWS, ROOM_ROWS } from "@/lib/wizard";
import { duplicateProjectAction, restoreSnapshotAction, saveSnapshotAction } from "@/app/actions/projects";
import DeleteProjectDialog from "../DeleteProjectDialog";
import ConditionsCard from "./ConditionsCard";
import { collectOptions } from "@/lib/options";
import type { ProjectRecord } from "@/lib/data";

const T = "Total";

export default function StepSummary({
  project,
  snapshots,
  canDelete,
}: {
  project: ProjectRecord;
  snapshots: { id: number; label: string; summary: unknown; created_at: string; username: string | null }[];
  canDelete: boolean;
}) {
  const { wb, t, lang, saveNow, projectId, version, canEdit } = useProject();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  void version;
  if (!wb) return null;

  const g = (c: string) => wb.get(T, c);
  const rows = [...MAIN_CHAMBER_ROWS, ...ROOM_ROWS, ...EXTRA_ROWS].filter((r) => {
    const v = g(`C${r}`);
    return typeof v === "number" && v > 0;
  });

  const options = collectOptions(wb);
  const optionsTotal = options.reduce((a, o) => a + o.total, 0);

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* 항목별 내역 */}
        <section className="card overflow-x-auto">
          <h2 className="px-4 py-2.5 text-[14px] font-bold text-slate-900">{t("perItem")}</h2>
          <table className="tbl w-full text-[12px]">
            <thead>
              <tr>
                <th className="min-w-[180px]">{t("chamberType")}</th>
                <th className="w-14 text-right">{t("incl")}</th>
                <th className="text-right">{t("materialSales")}</th>
                <th className="text-right">{t("installSales")}</th>
                <th className="text-right">{t("transport")}</th>
                <th className="text-right">{t("netSales")}</th>
                <th className="text-right">{t("salesEur")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    {t("noChamberYet")}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r}>
                  <td className="font-medium text-slate-800">{fmtValue(g(`B${r}`))}</td>
                  <td className="text-right tabular-nums">{fmtValue(g(`C${r}`))}</td>
                  <td className="text-right tabular-nums">{fmtEur(g(`F${r}`))}</td>
                  <td className="text-right tabular-nums">{fmtEur(g(`V${r}`))}</td>
                  <td className="text-right tabular-nums">
                    {fmtEur(typeof g(`Y${r}`) === "number" && typeof g(`AA${r}`) === "number" ? (g(`Y${r}`) as number) + (g(`AA${r}`) as number) : g(`Y${r}`))}
                  </td>
                  <td className="text-right tabular-nums">{fmtEur(g(`AD${r}`))}</td>
                  <td className="text-right font-semibold tabular-nums">{fmtEur(g(`AE${r}`))}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>{t("grandTotal")}</td>
                <td className="text-right">{fmtEur(g("F64"))}</td>
                <td className="text-right">{fmtEur(g("V64"))}</td>
                <td className="text-right">
                  {fmtEur(typeof g("Y64") === "number" && typeof g("AA64") === "number" ? (g("Y64") as number) + (g("AA64") as number) : g("Y64"))}
                </td>
                <td className="text-right">{fmtEur(g("AD64"))}</td>
                <td className="text-right">{fmtEur(g("AE64"))}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {options.length > 0 && (
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-baseline gap-3 px-4 py-2.5">
              <h2 className="text-[14px] font-bold text-slate-900">{t("optionsOffered")}</h2>
              <span className="card-sub">{t("optionsNotIncluded")}</span>
              <span className="ml-auto text-[14px] font-bold tabular-nums text-slate-800">{fmtEur(optionsTotal)}</span>
            </div>
            <table className="tbl w-full text-[12px]">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th className="!text-left">{t("fgDesc")}</th>
                  <th className="w-16 text-right">{t("fgQty")}</th>
                  <th className="w-20 text-center">{t("optOrder")}</th>
                  <th className="w-36 text-right">{t("optAdjPrice")}</th>
                </tr>
              </thead>
              <tbody>
                {options.map((o) => (
                  <React.Fragment key={o.id}>
                    <tr className="bg-slate-50">
                      <td className="text-center text-[11px] font-semibold text-slate-500">{o.no}</td>
                      <td className="!text-left font-semibold text-slate-800">
                        {o.title}
                        {o.usd ? <span className="ml-2 text-[11px] font-normal text-slate-400">{fmtUsd(o.usd)}</span> : null}
                      </td>
                      <td />
                      <td className="text-center">
                        {o.ordered === undefined ? null : (
                          <span className={`badge ${o.ordered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{o.ordered ? "Y" : "N"}</span>
                        )}
                      </td>
                      <td className="text-right font-semibold tabular-nums text-slate-800">
                        {fmtEur(o.total)}
                        {o.adjusted && <span className="ml-1 text-[10px] text-amber-600">{t("optAdjusted")}</span>}
                      </td>
                    </tr>
                    {o.picks.map((p) => (
                      <tr key={p.row}>
                        <td />
                        <td className="!text-left text-slate-600">· {p.label}</td>
                        <td className="text-right tabular-nums text-slate-600">{p.qty || ""}</td>
                        <td className="text-center">
                          {o.ordered === undefined && (
                            <span className={`badge ${p.ordered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{p.ordered ? "Y" : "N"}</span>
                          )}
                        </td>
                        <td className="text-right tabular-nums text-slate-600">{fmtEur(p.amount)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 스냅샷 */}
        <section className="card panel p-4">
          <h2 className="card-title mb-2">{t("snapshots")}</h2>
          <div className={`mb-2 flex gap-2 ${canEdit ? "" : "hidden"}`}>
            <input className="field" placeholder={t("snapshotPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} />
            <button
              type="button"
              className="btn whitespace-nowrap"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await saveNow();
                await saveSnapshotAction(projectId, label || new Date().toLocaleString(), {
                  finalEur: g("AE66"),
                  materialSales: g("F64"),
                  installSales: g("V64"),
                });
                setLabel("");
                setBusy(false);
              }}
            >
              {t("snapshot")}
            </button>
          </div>
          <ul className="space-y-1 text-[12px]">
            {snapshots.length === 0 && <li className="py-2 text-slate-400">—</li>}
            {snapshots.map((s) => {
              const sum = s.summary as { finalEur?: number } | null;
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1">
                  <span>
                    <b>{s.label}</b>
                    <span className="ml-1 text-slate-500">
                      {new Date(s.created_at).toLocaleString()} · {s.username ?? ""}
                    </span>
                    {sum?.finalEur !== undefined && <span className="ml-2 tabular-nums text-brand">{fmtEur(sum.finalEur)}</span>}
                  </span>
                  <button
                    type="button"
                    className={`text-slate-500 hover:text-brand hover:underline ${canEdit ? "" : "hidden"}`}
                    onClick={async () => {
                      if (!confirm(t("restore") + "?")) return;
                      await restoreSnapshotAction(projectId, s.id);
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
      </div>

      {/* 견적 조건 (4단계에서 입력한 내용) */}
      <ConditionsCard readOnly />

      {/* 최종가 · 프로젝트 정보 · 작업 — 내역 아래 한 열로 */}
      <aside className="panel space-y-4">
        <section className="card border-brand bg-red-50 p-4">
          <div className="eyebrow text-brand">{t("finalPrice")}</div>
          <div className="mt-1 text-[28px] font-bold tabular-nums leading-tight text-brand">{fmtEur(g("AE66"))}</div>
          <div className="mt-2 space-y-0.5 border-t border-red-200 pt-2 text-[12px]">
            {[
              ["AE67", t("withBidBond"), "eur"],
              ...(typeof g("E68") === "number" && (g("E68") as number) > 0
                ? ([
                    ["AF66", t("pricingDap"), "usd"],
                    ["AG66", t("pricingDdp"), "usd"],
                  ] as string[][])
                : []),
            ].map(([c, l, f]) => (
              <div key={c} className="flex justify-between">
                <span className="text-slate-600">{l}</span>
                <b className="tabular-nums text-slate-800">{f === "usd" ? fmtUsd(g(c)) : fmtEur(g(c))}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4 text-[12px]">
          <h2 className="card-title mb-2">{t("customerInfo")}</h2>
          {[
            [t("customer"), project.customer],
            [t("country"), project.country],
            [t("quotationNo"), project.quotation_no + (project.revision ? ` / ${project.revision}` : "")],
            [t("editor"), project.editor],
            [t("status"), project.status],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-slate-100 py-1">
              <span className="text-slate-500">{k}</span>
              <span className="text-slate-800">{v || "—"}</span>
            </div>
          ))}
          {project.notes && <p className="mt-2 whitespace-pre-wrap text-slate-600">{project.notes}</p>}
        </section>

        <section className="card space-y-2 p-4">
          <button type="button" className="btn-secondary w-full justify-center" onClick={() => window.print()}>
            {t("printView")}
          </button>
          <button type="button" className="btn-secondary w-full justify-center" onClick={() => void duplicateProjectAction(projectId)}>
            {t("copyProject")}
          </button>
          {canDelete && <DeleteProjectDialog projectId={projectId} projectName={project.name} lang={lang} variant="button" afterDelete="/" />}
        </section>
      </aside>
    </div>
  );
}

"use client";

import React, { useMemo, useState } from "react";
import { ROW_SHEET_FIX, SPECIAL_PART_ROWS } from "@/lib/wizard";
import Link from "next/link";
import { useProject } from "./ProjectStore";
import { Calc, CellEditor } from "./cells";
import CellGrid, { listOptions } from "./CellGrid";
import { fmtEur, fmtUsd, fmtValue } from "@/lib/format";
import SaveBadge from "./SaveBadge";
import { sheetSlug } from "@/lib/slug";
import { DictKey } from "@/lib/i18n";

const T = "Total";
const CHAMBER_ROWS = [...Array.from({ length: 46 }, (_, i) => 9 + i), 57, 58, 59, 60];

/** Total!E{row} 수식에서 참조 시트명 추출 (예: 'CHC Plus'!H222 → CHC Plus) */
function sourceSheet(f?: string): string | null {
  if (!f) return null;
  const m = /^'([^']+)'!|^([A-Za-z][A-Za-z0-9\- ]*?)!/.exec(f);
  return m ? (m[1] ?? m[2]) : null;
}

export default function TotalView({ projectName }: { projectName: string }) {
  const { wb, ready, error, t, projectId, version, templateVersion } = useProject();
  const [detailed, setDetailed] = useState(false);
  const [openOpt, setOpenOpt] = useState<Record<string, boolean>>({});
  void version;

  const lists = useMemo(() => {
    if (!wb) return null;
    return {
      supervisor: listOptions(wb, "Supervisor"),
      manpower: listOptions(wb, "Manpower"),
      travel: listOptions(wb, "Travel_cost"),
      transport: listOptions(wb, "Type_of_transportation"),
    };
  }, [wb]);

  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!ready || !wb || !lists) return <div className="p-6 text-slate-500">{t("loadingEngine")}</div>;

  const tpl = wb.template.sheets[T].cells;
  const g = (coord: string) => wb.get(T, coord);
  const sheetOf = (row: number) => {
    const sp = SPECIAL_PART_ROWS[row];
    if (sp) return sp.sheet; // 전용 시트가 없는 행은 링크를 걸지 않는다
    return ROW_SHEET_FIX[row] ?? sourceSheet(tpl[`E${row}`]?.f);
  };

  const detailCols = detailed;
  const optProps = (id: string) => ({ open: !!openOpt[id], toggle: () => setOpenOpt((o) => ({ ...o, [id]: !o[id] })) });

  return (
    <div className="shell">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold text-slate-900">{projectName}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
          {t("total")} · {templateVersion}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-slate-500">{t("legend")}</span>
          <SaveBadge />
        </div>
      </div>

      {/* 최종가 요약 */}
      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {[
          { label: t("materialSales"), v: fmtEur(g("F64")) },
          { label: t("installSales"), v: fmtEur(g("V64")) },
          { label: t("transport"), v: fmtEur(typeof g("Y64") === "number" && typeof g("AA64") === "number" ? (g("Y64") as number) + (g("AA64") as number) : g("Y64")) },
          { label: t("netSales"), v: fmtEur(g("AD64")) },
          { label: t("finalEur"), v: fmtEur(g("AE66")), strong: true },
          { label: t("pricingDap"), v: fmtUsd(g("AF66")) },
        ].map((k) => (
          <div key={k.label} className={`card px-3 py-2 ${k.strong ? "border-emerald-300 bg-emerald-50" : ""}`}>
            <div className="text-[11px] text-slate-500">{k.label}</div>
            <div className={`text-[16px] font-bold tabular-nums ${k.strong ? "text-emerald-800" : "text-slate-900"}`}>{k.v}</div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        {/* 공통 설정 */}
        <aside className="space-y-4 xl:sticky xl:top-3 xl:self-start">
          <section className="card p-3">
            <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("globalSettings")}</h2>
            <Setting label="svType" coord="L7" kind="select" options={lists.supervisor} />
            <Setting label="workerType" coord="O7" kind="select" options={lists.manpower} />
            <Setting label="extraWorkerType" coord="R7" kind="select" options={lists.manpower} />
            <Setting label="surchargeSv" coord="H4" fmt="eur" />
            <Setting label="travelRegion" coord="T7" kind="select" options={lists.travel} />
            <Setting label="transportType" coord="X6" kind="select" options={lists.transport} />
            <Setting label="transportCn" coord="AA8" fmt="eur" />
            <Setting label="fxUsd" coord="E68" />
            <Setting label="fxRmb" coord="E69" />
            <Setting label="fxInr" coord="E70" />
            <Setting label="ferriteDiscount" coord="J67" fmt="pct" />
            <Setting label="bidBond" coord="AD67" fmt="pct" />
            <Setting label="ddp" coord="AG70" kind="yn" />
            <Setting label="importTax" coord="AF70" fmt="pct" />
            <div className="mt-2 grid grid-cols-2 gap-x-3 text-[11px] text-slate-500">
              <div>
                SV/day: <b className="text-slate-700">{fmtEur(g("L8"))}</b>
              </div>
              <div>
                Worker/day: <b className="text-slate-700">{fmtEur(g("O8"))}</b>
              </div>
              <div>
                Travel/person: <b className="text-slate-700">{fmtEur(g("T8"))}</b>
              </div>
              <div>
                Travel days: <b className="text-slate-700">{fmtValue(g("K5"))}</b>
              </div>
              <div>
                40ft cont. PL: <b className="text-slate-700">{fmtEur(g("Y8"))}</b>
              </div>
            </div>
          </section>
          <section className="card p-3">
            <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("finalPrice")}</h2>
            {[
              ["AE66", t("finalEur"), "eur"],
              ["AE67", t("withBidBond"), "eur"],
              ["AF66", t("pricingDap"), "usd"],
              ["AG66", t("pricingDdp"), "usd"],
              ["AF71", "Import tax $", "usd"],
              ["AG71", "DDP total $", "usd"],
            ].map(([c, l, f]) => (
              <div key={c} className="flex justify-between border-b border-slate-100 py-1 text-[12px]">
                <span className="text-slate-600">{l}</span>
                <b className="tabular-nums">{fmtValue(g(c), f)}</b>
              </div>
            ))}
          </section>
        </aside>

        <div className="space-y-4">
          {/* 챔버 테이블 */}
          <section className="card overflow-x-auto">
            <div className="flex items-center gap-3 px-3 py-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("chamberTable")}</h2>
              <label className="ml-auto flex items-center gap-1 text-[12px] text-slate-600">
                <input type="checkbox" checked={detailed} onChange={(e) => setDetailed(e.target.checked)} /> Detail
              </label>
            </div>
            <table className="tbl w-full text-[12px]">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th className="min-w-[180px]">{t("chamberType")}</th>
                  <th className="w-14 text-right">{t("incl")}</th>
                  <th className="w-14 text-right">{t("factor")}</th>
                  <th className="text-right">{t("materialCost")}</th>
                  <th className="text-right">{t("materialSales")}</th>
                  <th className="w-14 text-right">{t("installFactor")}</th>
                  {detailCols && <th className="w-14 text-right">{t("cycles")}</th>}
                  <th className="w-12 text-right">{t("svQty")}</th>
                  <th className="w-16 text-right">{t("svDays")}</th>
                  {detailCols && <th className="text-right">SV €</th>}
                  <th className="w-12 text-right">{t("workerQty")}</th>
                  <th className="w-16 text-right">{t("workerDays")}</th>
                  {detailCols && <th className="text-right">Worker €</th>}
                  {detailCols && <th className="w-12 text-right">{t("extraQty")}</th>}
                  {detailCols && <th className="w-16 text-right">{t("extraDays")}</th>}
                  {detailCols && <th className="text-right">Extra €</th>}
                  {detailCols && <th className="text-right">{t("installCost")}</th>}
                  {detailCols && <th className="text-right">{t("travel")}</th>}
                  {detailCols && <th className="text-right">{t("tools")}</th>}
                  <th className="text-right">{t("installSales")}</th>
                  <th className="w-12 text-right">{t("contPl")}</th>
                  <th className="w-12 text-right">{t("contCn")}</th>
                  <th className="text-right">{t("transport")}</th>
                  <th className="w-16 text-right">{t("commission")}</th>
                  <th className="text-right">{t("netSales")}</th>
                  <th className="text-right">{t("salesEur")}</th>
                  <th className="text-right">{t("salesUsd")}</th>
                  {detailCols && <th className="text-right">{t("salesUsdDdp")}</th>}
                </tr>
              </thead>
              <tbody>
                {CHAMBER_ROWS.map((r, idx) => {
                  const name = fmtValue(g(`B${r}`));
                  const sheet = sheetOf(r);
                  const included = typeof g(`C${r}`) === "number" && (g(`C${r}`) as number) > 0;
                  const rowEl = (
                    <tr key={r} className={included ? "bg-emerald-50/40" : ""}>
                      <td className="text-slate-400">{fmtValue(g(`A${r}`))}</td>
                      <td>
                        {sheet ? (
                          <Link href={`/projects/${projectId}/sheet/${sheetSlug(sheet)}`} className="font-medium text-sky-700 hover:underline" title={t("openSheet")}>
                            {name}
                          </Link>
                        ) : (
                          <span className="font-medium">{name}</span>
                        )}
                      </td>
                      <td>
                        <Num coord={`C${r}`} />
                      </td>
                      <td>
                        <Num coord={`D${r}`} />
                      </td>
                      <td className="text-right">
                        <C coord={`E${r}`} />
                      </td>
                      <td className="text-right">
                        <C coord={`F${r}`} />
                      </td>
                      <td>
                        <Num coord={`H${r}`} />
                      </td>
                      {detailCols && (
                        <td>
                          <Num coord={`I${r}`} />
                        </td>
                      )}
                      <td>
                        <Num coord={`J${r}`} />
                      </td>
                      <td>
                        <Num coord={`K${r}`} fmt="d1" />
                      </td>
                      {detailCols && (
                        <td className="text-right">
                          <C coord={`L${r}`} />
                        </td>
                      )}
                      <td>
                        <Num coord={`M${r}`} />
                      </td>
                      <td>
                        <Num coord={`N${r}`} fmt="d1" />
                      </td>
                      {detailCols && (
                        <td className="text-right">
                          <C coord={`O${r}`} />
                        </td>
                      )}
                      {detailCols && (
                        <td>
                          <Num coord={`P${r}`} />
                        </td>
                      )}
                      {detailCols && (
                        <td>
                          <Num coord={`Q${r}`} fmt="d1" />
                        </td>
                      )}
                      {detailCols && (
                        <td className="text-right">
                          <C coord={`R${r}`} />
                        </td>
                      )}
                      {detailCols && (
                        <td className="text-right">
                          <C coord={`S${r}`} />
                        </td>
                      )}
                      {detailCols && (
                        <td className="text-right">
                          <C coord={`T${r}`} />
                        </td>
                      )}
                      {detailCols && (
                        <td className="text-right">
                          <C coord={`U${r}`} />
                        </td>
                      )}
                      <td className="text-right">
                        <C coord={`V${r}`} />
                      </td>
                      <td>
                        <Num coord={`X${r}`} />
                      </td>
                      <td>
                        <Num coord={`Z${r}`} />
                      </td>
                      <td className="text-right">
                        <Calc value={typeof g(`Y${r}`) === "number" && typeof g(`AA${r}`) === "number" ? (g(`Y${r}`) as number) + (g(`AA${r}`) as number) : g(`Y${r}`)} fmt="eur" />
                      </td>
                      <td>
                        <Num coord={`AC${r}`} fmt="pct" />
                      </td>
                      <td className="text-right">
                        <C coord={`AD${r}`} />
                      </td>
                      <td className="text-right font-semibold">
                        <C coord={`AE${r}`} />
                      </td>
                      <td className="text-right">
                        <C coord={`AF${r}`} fmt="usd" />
                      </td>
                      {detailCols && (
                        <td className="text-right">
                          <C coord={`AG${r}`} fmt="usd" />
                        </td>
                      )}
                    </tr>
                  );
                  // Subtotal 1 행 (54 다음)
                  if (r === 54 || r === 60) {
                    const sr = r === 54 ? 55 : 61;
                    const label = r === 54 ? t("subtotal1") : t("subtotal2");
                    return (
                      <React.Fragment key={r}>
                        {rowEl}
                        <SubtotalRow row={sr} label={label} detailed={detailCols} g={g} />
                        {r === 60 && <SubtotalRow row={64} label={t("grandTotal")} detailed={detailCols} g={g} strong />}
                      </React.Fragment>
                    );
                  }
                  void idx;
                  return rowEl;
                })}
              </tbody>
            </table>
          </section>

          {/* 옵션 블록 */}
          <h2 className="pt-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("options")}</h2>
          <OptBlock {...optProps("o11")} title={t("option11")}>
            <CellGrid sheet={T} r1={77} r2={113} c1={1} c2={14} extraSelects={{ E78: ["-", ...lists.supervisor], D78: ["18", "40"] }} />
          </OptBlock>
          <OptBlock {...optProps("o12")} title={t("option12")}>
            <CellGrid sheet={T} r1={116} r2={124} c1={1} c2={15} extraSelects={{ F117: ["USA", "Europe", "Asia & South America", "Mexico, Canada, Brazil"], I117: lists.supervisor }} />
          </OptBlock>
          <OptBlock {...optProps("o2")} title={t("option2")}>
            <CellGrid sheet={T} r1={129} r2={158} c1={1} c2={11} />
          </OptBlock>
          <OptBlock {...optProps("o3")} title={t("option3")}>
            <CellGrid sheet={T} r1={163} r2={166} c1={1} c2={11} />
          </OptBlock>
          <OptBlock {...optProps("o4")} title={t("option4")}>
            <CellGrid sheet={T} r1={171} r2={179} c1={1} c2={11} />
          </OptBlock>
          <h2 className="pt-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("conditions")}</h2>
          <OptBlock {...optProps("cond")} title={t("conditions")}>
            <CellGrid sheet={T} r1={74} r2={113} c1={20} c2={31} editableTextCols={[21, 22, 23, 24]} />
          </OptBlock>
        </div>
      </div>
    </div>
  );
}

function Setting({ label, coord, kind = "num", options, fmt }: { label: DictKey; coord: string; kind?: "num" | "select" | "yn" | "text"; options?: string[]; fmt?: string }) {
  const { t } = useProject();
  return (
    <label className="flex items-center justify-between gap-2 border-b border-slate-100 py-1 text-[12px]">
      <span className="text-slate-600">
        {t(label)} <span className="font-mono text-[10px] text-slate-400">{coord}</span>
      </span>
      <span className="w-44">
        <CellEditor sheet={T} coord={coord} kind={kind} options={options} fmt={fmt} className="w-full justify-end" />
      </span>
    </label>
  );
}

function Num({ coord, fmt }: { coord: string; fmt?: string }) {
  return <CellEditor sheet={T} coord={coord} kind="num" fmt={fmt} className="w-full justify-end" />;
}

/** Total 시트 계산 셀 */
function C({ coord, fmt = "eur" }: { coord: string; fmt?: string }) {
  const { wb } = useProject();
  return <Calc value={wb!.get(T, coord)} fmt={fmt} />;
}

function OptBlock({ open, toggle, title, children }: { open: boolean; toggle: () => void; title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold text-slate-800" onClick={toggle}>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
        {title}
      </button>
      {open && <div className="border-t border-slate-100 p-2">{children}</div>}
    </section>
  );
}

function SubtotalRow({ row, label, detailed, g, strong }: { row: number; label: string; detailed: boolean; g: (c: string) => ReturnType<NonNullable<ReturnType<typeof useProject>["wb"]>["get"]>; strong?: boolean }) {
  return (
    <tr className={strong ? "total" : "subtotal"}>
      <td></td>
      <td>{label}</td>
      <td></td>
      <td></td>
      <td className="text-right">
        <C coord={`E${row}`} />
      </td>
      <td className="text-right">
        <C coord={`F${row}`} />
      </td>
      <td></td>
      {detailed && <td></td>}
      <td></td>
      <td></td>
      {detailed && <td></td>}
      <td></td>
      <td></td>
      {detailed && <td></td>}
      {detailed && <td></td>}
      {detailed && <td></td>}
      {detailed && <td></td>}
      {detailed && (
        <td className="text-right">
          <C coord={`S${row}`} />
        </td>
      )}
      {detailed && <td></td>}
      {detailed && <td></td>}
      <td className="text-right">
        <C coord={`V${row}`} />
      </td>
      <td className="text-right">{fmtValue(g(`X${row}`))}</td>
      <td className="text-right">{fmtValue(g(`Z${row}`))}</td>
      <td className="text-right">
        <Calc value={typeof g(`Y${row}`) === "number" && typeof g(`AA${row}`) === "number" ? (g(`Y${row}`) as number) + (g(`AA${row}`) as number) : g(`Y${row}`)} fmt="eur" />
      </td>
      <td></td>
      <td className="text-right">
        <C coord={`AD${row}`} />
      </td>
      <td className="text-right">
        <C coord={`AE${row}`} />
      </td>
      <td className="text-right">
        <C coord={`AF${row}`} fmt="usd" />
      </td>
      {detailed && (
        <td className="text-right">
          <C coord={`AG${row}`} fmt="usd" />
        </td>
      )}
    </tr>
  );
}

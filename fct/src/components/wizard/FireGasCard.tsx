"use client";

import { useProject } from "../ProjectStore";
import { Calc, CellEditor } from "../cells";
import { fmtEur } from "@/lib/format";
import { QuoteCols, QuoteHead } from "./QuoteTable";
import { FG_COL, FG_SHEET, FG_TOTAL_ROW, buildFireGas, fireGasCost, fireGasOutOfSync, syncFireGasTotal } from "@/lib/fire-gas";

const T = "Total";

const co = (col: string, row: number) => `${col}${row}`;

/** 금액을 계산하는 한 줄 — 템플릿이 수식인 칸은 자동 계산, 나머지는 직접 입력 */
function FgMoneyRow({ row }: { row: number }) {
  const { wb, t, version } = useProject();
  void version;
  const tpl = wb!.template.sheets[FG_SHEET];
  const isCalc = (col: string) => !!tpl.cells[co(col, row)]?.f;
  const note = wb!.get(FG_SHEET, co(FG_COL.note, row));
  const ref = wb!.get(FG_SHEET, co(FG_COL.ref, row));
  return (
    <tr>
      {/* 제품 번호는 천단위 구분 없이 그대로 */}
      <td className="text-center text-[11px] text-slate-500">{ref === null || ref === undefined ? "" : String(ref)}</td>
      <td>
        {isCalc(FG_COL.desc) ? (
          <Calc value={wb!.get(FG_SHEET, co(FG_COL.desc, row))} className="!text-left" />
        ) : (
          <CellEditor sheet={FG_SHEET} coord={co(FG_COL.desc, row)} kind="text" className="w-full" placeholder={t("fgDescPlaceholder")} />
        )}
        {typeof note === "string" && note.trim() && <div className="mt-0.5 text-[10px] text-amber-700">{note.trim()}</div>}
      </td>
      <td>
        {isCalc(FG_COL.qty) ? (
          <Calc value={wb!.get(FG_SHEET, co(FG_COL.qty, row))} />
        ) : (
          <CellEditor sheet={FG_SHEET} coord={co(FG_COL.qty, row)} kind="num" step={1} className="w-full" />
        )}
      </td>
      <td>
        <CellEditor sheet={FG_SHEET} coord={co(FG_COL.unitCost, row)} kind="num" fmt="eur" className="w-full" />
      </td>
      <td>
        <Calc value={wb!.get(FG_SHEET, co(FG_COL.totalCost, row))} fmt="eur" />
      </td>
      <td>
        <Calc value={wb!.get(FG_SHEET, co(FG_COL.sales, row))} fmt="eur" />
      </td>
      <td>
        <Calc value={wb!.get(FG_SHEET, co(FG_COL.offer, row))} fmt="eur" />
      </td>
    </tr>
  );
}

/**
 * Purchased Parts (Fire, Gas) — 엑셀 `Fire & Gas` 탭 양식.
 * 품명·수량·단가를 직접 입력할 수 있고, OPTIONS 행은 완전 자유 입력이다.
 */
export default function FireGasCard() {
  const { wb, t, version, touch, canEdit } = useProject();
  void version;

  if (!wb) return null;
  const tpl = wb.template.sheets[FG_SHEET];
  if (!tpl) return null;

  const blocks = buildFireGas(tpl);
  const cost = fireGasCost(wb, blocks);
  const outOfSync = fireGasOutOfSync(wb);

  return (
    <div className="space-y-4">
      {/* FACTOR · NEGO · 합계 */}
      <section className="card border-l-4 border-l-brand p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <h2 className="card-title">{t("fgTitle")}</h2>
          <span className="card-sub">{t("fgHint")}</span>
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">{t("fgFactor")}</span>
            <span className="block w-24">
              <CellEditor sheet={T} coord={`D${FG_TOTAL_ROW}`} kind="num" fmt="d2" className="w-full" />
            </span>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">{t("fgNego")}</span>
            <span className="flex w-24 items-center gap-1">
              <CellEditor sheet={T} coord={`AC${FG_TOTAL_ROW}`} kind="pct" fmt="pct" className="w-full" />
              <span className="text-[11px] text-slate-400">%</span>
            </span>
          </label>
          <div className="ml-auto rounded bg-slate-50 px-3 py-2 text-right">
            <div className="text-[11px] text-slate-500">{t("fgCostTotal")}</div>
            <div className="text-[15px] font-bold tabular-nums text-slate-800">{fmtEur(cost)}</div>
          </div>
        </div>
        {outOfSync && canEdit && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            <span>{t("fgOutOfSync")}</span>
            <button
              type="button"
              className="btn-secondary !px-2 !py-0.5 !text-[11px]"
              onClick={() => {
                if (syncFireGasTotal(wb)) touch();
              }}
            >
              {t("fgSyncNow")}
            </button>
          </div>
        )}
      </section>

      {blocks.map((b) => (
        <section key={b.titleRow} className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5">
            <span className="text-[14px] font-semibold text-slate-800">{b.title}</span>
            <label className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
              {t("fgOfferNo")}
              <span className="block w-56">
                <CellEditor sheet={FG_SHEET} coord={b.offerCoord} kind="text" className="w-full" />
              </span>
            </label>
          </div>

          <table className="tbl tbl-fixed w-full">
            <QuoteCols />
            <QuoteHead t={t} />
            <tbody>
              {b.lines
                .filter((l) => l.kind !== "option")
                .map((l) =>
                  l.kind === "group" ? (
                    <tr key={l.row} className="bg-slate-50/70">
                      <td className="text-center text-[11px] text-slate-500">{String(tpl.cells[co(FG_COL.ref, l.row)]?.v ?? "")}</td>
                      <td colSpan={6} className="text-[12px] font-semibold text-slate-600">
                        {String(wb.get(FG_SHEET, co(FG_COL.desc, l.row)) ?? "")}
                      </td>
                    </tr>
                  ) : (
                    <FgMoneyRow key={l.row} row={l.row} />
                  ),
                )}
              {b.totalRow && (
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td />
                  <td className="text-[12px] text-slate-700">{t("fgTotalRow")}</td>
                  <td />
                  <td />
                  <td>
                    <Calc value={wb.get(FG_SHEET, co(FG_COL.totalCost, b.totalRow))} fmt="eur" />
                  </td>
                  <td>
                    <Calc value={wb.get(FG_SHEET, co(FG_COL.sales, b.totalRow))} fmt="eur" />
                  </td>
                  <td>
                    <Calc value={wb.get(FG_SHEET, co(FG_COL.offer, b.totalRow))} fmt="eur" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {b.options.length > 0 && (
            <>
              <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-1.5 text-[12px] font-semibold text-slate-600">
                {t("fgOptions")}
                <span className="text-[10px] font-normal text-slate-400">{t("fgOptionsHint")}</span>
              </div>
              <table className="tbl tbl-fixed w-full">
                <QuoteCols />
                <tbody>
                  {b.options.map((row) => (
                    <FgMoneyRow key={row} row={row} />
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

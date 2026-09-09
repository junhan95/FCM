"use client";

import { useProject } from "../ProjectStore";
import { Calc, CellEditor } from "../cells";
import { fmtEur, fmtValue } from "@/lib/format";
import { ExcelError } from "@/engine/types";
import { MON_COL, MON_SHEET, MON_TOTAL_ROW, MonBlock, MonForm, blockCost, buildMonitoring } from "@/lib/monitoring";

const T = "Total";
const co = (col: string, row: number) => `${col}${row}`;

/** 표 열 폭 — 블록이 나뉘어도 세로줄이 일직선이 되게 공유한다 */
const MON_COLS = ["78px", "96px", "auto", "180px", "92px", "108px", "110px", "116px"];
const MonCols = () => (
  <colgroup>
    {MON_COLS.map((w, i) => (
      <col key={i} style={{ width: w }} />
    ))}
  </colgroup>
);

/** 아직 고르지 않아 생기는 #N/A 는 — 로 보여 준다 */
function Val({ coord, fmt, left }: { coord: string; fmt?: string; left?: boolean }) {
  const { wb, version } = useProject();
  void version;
  const v = wb!.get(MON_SHEET, coord);
  if (v instanceof ExcelError && v.code === "#N/A") return <span className="cell-calc text-slate-300">—</span>;
  return <Calc value={v} fmt={fmt} className={left ? "!text-left" : ""} />;
}

function MonItemRow({ row, broken }: { row: number; broken?: boolean }) {
  const { wb, t, version } = useProject();
  void version;
  const tpl = wb!.template.sheets[MON_SHEET];
  const isCalc = (col: string) => !!tpl.cells[co(col, row)]?.f;
  const detail = wb!.get(MON_SHEET, co(MON_COL.detail, row));
  return (
    <tr>
      <td>
        {isCalc(MON_COL.ref) ? (
          <Val coord={co(MON_COL.ref, row)} />
        ) : (
          <CellEditor sheet={MON_SHEET} coord={co(MON_COL.ref, row)} kind="num" className="w-full !text-center" />
        )}
      </td>
      <td className="text-center text-[11px] text-slate-500">
        <Val coord={co(MON_COL.sage, row)} />
      </td>
      <td className="!text-left">
        {isCalc(MON_COL.desc) ? (
          <span className="text-[12px] text-slate-700">{fmtValue(wb!.get(MON_SHEET, co(MON_COL.desc, row)))}</span>
        ) : (
          <CellEditor sheet={MON_SHEET} coord={co(MON_COL.desc, row)} kind="text" className="w-full" />
        )}
        {broken && (
          <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700" title={t("monBrokenRowHint")}>
            {t("monBrokenRow")}
          </span>
        )}
      </td>
      <td className="!text-left whitespace-normal py-1.5 text-[11px] leading-snug text-slate-500">
        {typeof detail === "string" ? detail : fmtValue(detail)}
      </td>
      <td>
        <CellEditor sheet={MON_SHEET} coord={co(MON_COL.qty, row)} kind="num" fmt="int" step={1} className="w-full" />
      </td>
      <td>
        {isCalc(MON_COL.unitCost) ? (
          <Val coord={co(MON_COL.unitCost, row)} fmt="eur" />
        ) : (
          <CellEditor sheet={MON_SHEET} coord={co(MON_COL.unitCost, row)} kind="num" fmt="eur" className="w-full" />
        )}
      </td>
      <td>
        <Val coord={co(MON_COL.totalCost, row)} fmt="eur" />
      </td>
      <td>
        <Val coord={co(MON_COL.sales, row)} fmt="eur" />
      </td>
    </tr>
  );
}

/** 한 블록의 품목표 */
function MonTable({ block }: { block: MonBlock }) {
  const { wb, t, version } = useProject();
  void version;
  return (
    <table className="tbl tbl-fixed w-full" style={{ minWidth: 1080 }}>
      <MonCols />
      <thead>
        <tr>
          <th>{t("monRef")}</th>
          <th>{t("monSage")}</th>
          <th className="!text-left">{t("fgDesc")}</th>
          <th className="!text-left">{t("monDetail")}</th>
          <th>{t("fgQty")}</th>
          <th>{t("fgUnitCost")}</th>
          <th>{t("fgTotalCost")}</th>
          <th>{t("fgSales")}</th>
        </tr>
      </thead>
      <tbody>
        {block.rows.map((r) =>
          r.kind === "group" ? (
            <tr key={r.row} className="bg-slate-50/70">
              <td colSpan={8} className="!text-left text-[12px] font-semibold text-slate-600">
                {fmtValue(wb!.get(MON_SHEET, co(MON_COL.desc, r.row)))}
              </td>
            </tr>
          ) : (
            <MonItemRow key={r.row} row={r.row} broken={r.broken} />
          ),
        )}
        {block.subtotalRow && (
          <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
            <td colSpan={6} className="!text-left text-[12px] text-slate-700">
              {fmtValue(wb!.get(MON_SHEET, co(MON_COL.desc, block.subtotalRow)))}
            </td>
            <td>
              <Val coord={co(MON_COL.totalCost, block.subtotalRow)} fmt="eur" />
            </td>
            <td>
              <Val coord={co(MON_COL.sales, block.subtotalRow)} fmt="eur" />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Y/N 스위치가 달린 일반 블록 (Additional Equipment · Freight & Packaging) */
function MonOptionalBlock({ block }: { block: MonBlock }) {
  const { wb, t, setCell, canEdit, version } = useProject();
  void version;
  const on = String(wb!.get(MON_SHEET, block.flagCoord) ?? "").toUpperCase() === "Y";
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5">
        <span className="text-[14px] font-semibold text-slate-800">{block.title}</span>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setCell(MON_SHEET, block.flagCoord, on ? "N" : "Y")}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
            on ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
          } ${canEdit ? "hover:ring-brand" : ""}`}
        >
          {on ? t("monIncluded") : t("monExcluded")}
        </button>
        {block.subtotalRow && (
          <span className="ml-auto text-[13px] font-bold tabular-nums text-slate-700">
            <Val coord={co(MON_COL.sales, block.subtotalRow)} fmt="eur" />
          </span>
        )}
      </div>
      {on ? (
        <div className="overflow-x-auto">
          <MonTable block={block} />
        </div>
      ) : (
        <p className="px-4 py-3 text-[12px] text-slate-400">{t("monExcludedHint")}</p>
      )}
    </section>
  );
}

/**
 * Monitoring Equipment — 엑셀 `Monitoring` 탭.
 * 먼저 Standard / Low Price 두 라인 중 하나를 고르고, 그다음 추가 장비와 운송·포장을 정한다.
 */
export default function MonitoringCard() {
  const { wb, t, setCell, canEdit, version } = useProject();
  void version;

  if (!wb) return null;
  const tpl = wb.template.sheets[MON_SHEET];
  if (!tpl) return null;
  const form: MonForm | null = buildMonitoring(tpl);
  if (!form) return null;

  const isOn = (coord: string) => String(wb.get(MON_SHEET, coord) ?? "").toUpperCase() === "Y";
  const lines = form.blocks.filter((b) => b.lineChoice);
  const extras = form.blocks.filter((b) => !b.lineChoice);
  const chosen = lines.find((b) => isOn(b.flagCoord)) ?? null;

  /** 라인은 둘 중 하나만 — 고른 것만 Y 로 두고 나머지는 N */
  const pickLine = (block: MonBlock) => {
    for (const b of lines) setCell(MON_SHEET, b.flagCoord, b.row === block.row ? "Y" : "N");
  };

  return (
    <div className="space-y-4">
      {/* 머리 — FACTOR · NEGO · 합계 */}
      <section className="card border-l-4 border-l-brand p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <h2 className="card-title">{t("monTitle")}</h2>
          <span className="card-sub">{form.supplier}</span>
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">{t("fgFactor")}</span>
            <span className="block w-24">
              <CellEditor sheet={T} coord={`D${MON_TOTAL_ROW}`} kind="num" fmt="d2" className="w-full" />
            </span>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">{t("fgNego")}</span>
            <span className="flex w-24 items-center gap-1">
              <CellEditor sheet={T} coord={`AC${MON_TOTAL_ROW}`} kind="pct" fmt="pct" className="w-full" />
              <span className="text-[11px] text-slate-400">%</span>
            </span>
          </label>
          {form.totalRow && (
            <div className="ml-auto rounded bg-slate-50 px-3 py-2 text-right">
              <div className="text-[11px] text-slate-500">{t("monTotal")}</div>
              <div className="text-[15px] font-bold tabular-nums text-slate-800">
                {fmtEur(wb.get(MON_SHEET, co(MON_COL.totalCost, form.totalRow)))}
              </div>
              <div className="text-[11px] tabular-nums text-slate-400">
                {t("monSheetSales")} {fmtEur(wb.get(MON_SHEET, co(MON_COL.sales, form.totalRow)))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 1) 라인 선택 */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5">
          <span className="text-[14px] font-semibold text-slate-800">{t("monPickLine")}</span>
          <span className="card-sub">{t("monPickLineHint")}</span>
        </div>
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {lines.map((b) => {
            const active = chosen?.row === b.row;
            return (
              <button
                key={b.row}
                type="button"
                disabled={!canEdit}
                onClick={() => pickLine(b)}
                className={`flex min-w-[260px] flex-1 flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors ${
                  active ? "border-brand bg-red-50/60 ring-1 ring-brand" : "border-slate-200 bg-white hover:border-brand/50"
                }`}
              >
                <span className="flex w-full items-center gap-2">
                  <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-[4px] ${active ? "border-brand bg-white" : "border-slate-300 bg-white"}`} />
                  <span className={`text-[13px] font-semibold ${active ? "text-brand" : "text-slate-700"}`}>{b.title}</span>
                </span>
                <span className="ml-[22px] text-[12px] tabular-nums text-slate-500">
                  {fmtEur(blockCost(b, (c) => wb.get(MON_SHEET, c)))} <span className="text-[10px] text-slate-400">{t("monLineCost")}</span>
                </span>
              </button>
            );
          })}
        </div>
        {!chosen && <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">{t("monNoLine")}</p>}
        {chosen && (
          <div className="overflow-x-auto border-t border-slate-100">
            <MonTable block={chosen} />
          </div>
        )}
      </section>

      {/* 2) 추가 장비 · 운송/포장 */}
      {extras.map((b) => (
        <MonOptionalBlock key={b.row} block={b} />
      ))}
    </div>
  );
}

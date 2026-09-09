"use client";

import { useState } from "react";
import { useProject } from "../ProjectStore";
import { Calc, CellEditor } from "../cells";
import { fmtEur } from "@/lib/format";
import { QuoteCols, QuoteHead } from "./QuoteTable";
import {
  CONDITION_META,
  ITEMS_SHEET,
  ITEM_FIELDS,
  MAX_ROWS,
  META_LABEL,
  QuoteRow,
  Section,
  isEmptyRow,
  itemCoord,
  metaCoord,
  offerOf,
  readRows,
  rowCount,
  salesOf,
  sumCost,
  usedRows,
} from "@/lib/custom-items";
import { LEGACY_SHEET, hasSheetOverrides, readSheetQuote } from "@/lib/purchased-parts";

const T = "Total";
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** 자유 입력 한 줄 — 템플릿 행이 없어 계산도 여기서 한다 */
function QuoteLine({
  row,
  sec,
  i,
  factor,
  nego,
  lockDesc,
  onRemove,
}: {
  row: number;
  sec: Section;
  i: number;
  factor: number;
  nego: number;
  /** 품명이 정해져 있는 줄 (프랑코니아 몫) */
  lockDesc?: string;
  onRemove?: () => void;
}) {
  const { wb, t, version, canEdit } = useProject();
  void version;
  const co = (f: (typeof ITEM_FIELDS)[number]) => itemCoord(row, sec, i, f);
  const cost = num(wb!.get(ITEMS_SHEET, co("qty"))) * num(wb!.get(ITEMS_SHEET, co("unit")));
  const sales = salesOf(cost, factor, nego);
  return (
    <tr>
      <td>
        {lockDesc !== undefined ? (
          <div className="text-center text-[11px] text-slate-400">—</div>
        ) : (
          <CellEditor sheet={ITEMS_SHEET} coord={co("ref")} kind="text" className="w-full !text-center" placeholder="—" />
        )}
      </td>
      <td>
        {lockDesc !== undefined ? (
          <div className="truncate text-[12px] text-slate-700">{lockDesc}</div>
        ) : (
          <CellEditor sheet={ITEMS_SHEET} coord={co("desc")} kind="text" className="w-full" placeholder={t("fgDescPlaceholder")} />
        )}
      </td>
      <td>
        <CellEditor sheet={ITEMS_SHEET} coord={co("qty")} kind="num" step={1} className="w-full" />
      </td>
      <td>
        <CellEditor sheet={ITEMS_SHEET} coord={co("unit")} kind="num" fmt="eur" className="w-full" />
      </td>
      <td>
        <Calc value={cost} fmt="eur" />
      </td>
      <td>
        <Calc value={sales} fmt="eur" />
      </td>
      <td>
        <Calc value={offerOf(sales)} fmt="eur" />
      </td>
      <td className="text-center">
        {onRemove && canEdit && (
          <button
            type="button"
            aria-label={t("extRemoveRow")}
            title={t("extRemoveRow")}
            onClick={onRemove}
            className="text-[13px] leading-none text-slate-300 hover:text-brand"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}

/** 줄 추가 버튼 */
function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-[18px] w-[18px] items-center justify-center rounded border border-slate-300 bg-white text-[13px] leading-none text-slate-400 hover:border-brand hover:text-brand"
    >
      +
    </button>
  );
}

/** 소계 · 총계 줄 */
function SumLine({ label, cost, factor, nego, strong }: { label: string; cost: number; factor: number; nego: number; strong?: boolean }) {
  const sales = salesOf(cost, factor, nego);
  return (
    <tr className={`border-t-2 border-slate-300 font-semibold ${strong ? "bg-slate-100" : "bg-slate-50"}`}>
      <td />
      <td className="text-[12px] text-slate-700">{label}</td>
      <td />
      <td />
      <td>
        <Calc value={cost} fmt="eur" />
      </td>
      <td>
        <Calc value={sales} fmt="eur" />
      </td>
      <td colSpan={2}>
        <Calc value={offerOf(sales)} fmt="eur" />
      </td>
    </tr>
  );
}

/**
 * 외부 견적 입력 화면 — Purchase Parts (Dyno,…) 와 E-Drive parts 가 함께 쓴다.
 * Price DB 에 없는 공급사 견적을 줄 수 제한 없이 직접 적는다.
 */
export default function ExternalItemsCard({ row, title }: { row: number; title: string }) {
  const { wb, t, version, overrides, setCell, canEdit } = useProject();
  const [removing, setRemoving] = useState<{ sec: Section; i: number; label: string } | null>(null);
  const [imported, setImported] = useState(false);
  void version;

  if (!wb) return null;

  const items = readRows(wb, row, "i");
  const services = readRows(wb, row, "s");
  const options = readRows(wb, row, "o");
  const factor = num(wb.get(T, `D${row}`));
  const nego = num(wb.get(T, `AC${row}`));
  const itemCost = sumCost(items);
  const serviceCost = sumCost(services);
  const grand = itemCost + serviceCost;

  /** 한 줄을 지우고 뒤의 줄을 하나씩 앞으로 당긴다 */
  const removeRow = (sec: Section, i: number) => {
    const all = readRows(wb, row, sec);
    const rest = all.filter((r) => r.i !== i);
    const n = Math.max(all.length, usedRows(overrides, row, sec));
    for (let k = 0; k < n; k++) {
      const src: QuoteRow | undefined = rest[k];
      for (const f of ITEM_FIELDS) {
        const v = src ? src[f] : undefined;
        setCell(ITEMS_SHEET, itemCoord(row, sec, k, f), v === 0 || v === "" || v === undefined ? undefined : v);
      }
    }
  };

  const addRow = (sec: Section) => {
    const n = rowCount(overrides, row, sec);
    if (n >= MAX_ROWS) return;
    setCell(ITEMS_SHEET, itemCoord(row, sec, n, "qty"), 1);
  };

  /** 예전 방식(엑셀 `Purchased Parts` 시트)에 남아 있는 값을 이 화면으로 옮긴다 */
  const legacy = LEGACY_SHEET[row];
  const canImport = !!legacy && !imported && hasSheetOverrides(wb, legacy) && !usedRows(overrides, row, "i");
  const importFromSheet = () => {
    const q = legacy ? readSheetQuote(wb, legacy) : null;
    if (!q) return;
    const put = (sec: Section, k: number, r: { ref: string; desc: string; qty: number; unit: number }) => {
      setCell(ITEMS_SHEET, itemCoord(row, sec, k, "ref"), r.ref || undefined);
      setCell(ITEMS_SHEET, itemCoord(row, sec, k, "desc"), r.desc || undefined);
      setCell(ITEMS_SHEET, itemCoord(row, sec, k, "qty"), r.qty || undefined);
      setCell(ITEMS_SHEET, itemCoord(row, sec, k, "unit"), r.unit || undefined);
    };
    q.items.forEach((r, k) => put("i", k, r));
    q.services.forEach((r, k) => put("s", k, r));
    q.options.forEach((r, k) => put("o", k, r));
    if (q.title.trim()) setCell(ITEMS_SHEET, metaCoord(row, "title"), q.title.trim());
    if (q.offer.trim()) setCell(ITEMS_SHEET, metaCoord(row, "offer"), q.offer.trim());
    for (const c of q.conditions) {
      const key = CONDITION_META.find((m) => META_LABEL[m] === c.label);
      if (key && c.value.trim()) setCell(ITEMS_SHEET, metaCoord(row, key), c.value.trim());
    }
    setImported(true);
  };

  return (
    <div className="space-y-4">
      <section className="card border-l-4 border-l-brand p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <h2 className="card-title">{title}</h2>
          <span className="card-sub">{t("extHint")}</span>
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">{t("fgFactor")}</span>
            <span className="block w-24">
              <CellEditor sheet={T} coord={`D${row}`} kind="num" fmt="d2" className="w-full" />
            </span>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">{t("fgNego")}</span>
            <span className="flex w-24 items-center gap-1">
              <CellEditor sheet={T} coord={`AC${row}`} kind="pct" fmt="pct" className="w-full" />
              <span className="text-[11px] text-slate-400">%</span>
            </span>
          </label>
          <div className="ml-auto rounded bg-slate-50 px-3 py-2 text-right">
            <div className="text-[11px] text-slate-500">{t("ppGrandTotal")}</div>
            <div className="text-[15px] font-bold tabular-nums text-slate-800">{fmtEur(grand)}</div>
          </div>
        </div>
        {canImport && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            <span>{t("extImportHint")}</span>
            <button type="button" className="btn-secondary !px-2 !py-0.5 !text-[11px]" onClick={importFromSheet}>
              {t("extImport")}
            </button>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5">
          <span className="block w-72">
            <CellEditor sheet={ITEMS_SHEET} coord={metaCoord(row, "title")} kind="text" className="w-full !font-semibold" placeholder={t("ppSubject")} />
          </span>
          <label className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
            {t("fgOfferNo")}
            <span className="block w-56">
              <CellEditor sheet={ITEMS_SHEET} coord={metaCoord(row, "offer")} kind="text" className="w-full" />
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2 bg-slate-50/70 px-4 py-1.5 text-[12px] font-semibold text-slate-600">
          {t("extItems")}
          <span className="text-[10px] font-normal text-slate-400">{t("extItemsHint")}</span>
          {canEdit && <AddRowButton label={t("extAddRow")} onClick={() => addRow("i")} />}
        </div>
        <table className="tbl tbl-fixed w-full">
          <QuoteCols actions />
          <QuoteHead t={t} actions />
          <tbody>
            {items.map((r) => (
              <QuoteLine
                key={r.i}
                row={row}
                sec="i"
                i={r.i}
                factor={factor}
                nego={nego}
                onRemove={() => (isEmptyRow(r) ? removeRow("i", r.i) : setRemoving({ sec: "i", i: r.i, label: r.desc || r.ref }))}
              />
            ))}
            <SumLine label={t("ppSubTotal")} cost={itemCost} factor={factor} nego={nego} />
          </tbody>
        </table>

        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-1.5 text-[12px] font-semibold text-slate-600">
          {t("ppServices")}
          <span className="text-[10px] font-normal text-slate-400">{t("ppServicesHint")}</span>
        </div>
        <table className="tbl tbl-fixed w-full">
          <QuoteCols actions />
          <tbody>
            {services.map((r) => (
              <QuoteLine key={r.i} row={row} sec="s" i={r.i} factor={factor} nego={nego} lockDesc={r.desc} />
            ))}
            <SumLine label={t("ppGrandTotal")} cost={grand} factor={factor} nego={nego} strong />
          </tbody>
        </table>

        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-1.5 text-[12px] font-semibold text-slate-600">
          {t("fgOptions")}
          <span className="text-[10px] font-normal text-slate-400">{t("fgOptionsHint")}</span>
          {canEdit && <AddRowButton label={t("extAddRow")} onClick={() => addRow("o")} />}
        </div>
        <table className="tbl tbl-fixed w-full">
          <QuoteCols actions />
          <tbody>
            {options.map((r) => (
              <QuoteLine
                key={r.i}
                row={row}
                sec="o"
                i={r.i}
                factor={factor}
                nego={nego}
                onRemove={() => (isEmptyRow(r) ? removeRow("o", r.i) : setRemoving({ sec: "o", i: r.i, label: r.desc || r.ref }))}
              />
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <h3 className="card-title">{t("ppConditions")}</h3>
          <span className="card-sub">{t("ppConditionsHint")}</span>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          {CONDITION_META.map((k) => (
            <label key={k} className="flex items-center gap-3">
              <span className="w-44 shrink-0 text-[12px] text-slate-500">{META_LABEL[k]}</span>
              <span className="min-w-0 flex-1">
                <CellEditor sheet={ITEMS_SHEET} coord={metaCoord(row, k)} kind="text" className="w-full" />
              </span>
            </label>
          ))}
        </div>
      </section>

      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setRemoving(null)}>
          <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title mb-1">{t("extRemoveRow")}</h3>
            <p className="mb-4 text-[13px] text-slate-600">
              {t("extRemoveConfirm")}
              <br />
              <span className="font-medium text-slate-800">{removing.label || "—"}</span>
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setRemoving(null)}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  removeRow(removing.sec, removing.i);
                  setRemoving(null);
                }}
              >
                {t("removeConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

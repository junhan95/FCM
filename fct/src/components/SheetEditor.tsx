"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useProject } from "./ProjectStore";
import { AutoCell, Calc, CellEditor } from "./cells";
import { coordOf, numToCol } from "@/engine/layout";
import { fmtEur, fmtValue } from "@/lib/format";
import { TemplateCell } from "@/engine/types";
import SaveBadge from "./SaveBadge";
export { sheetSlug } from "@/lib/slug";

export default function SheetEditor({ sheet }: { sheet: string }) {
  const { wb, ready, error, layout, t, projectId, version } = useProject();
  const [showSide, setShowSide] = useState(false);
  void version; // 재계산 시 리렌더 트리거

  const L = useMemo(() => (ready ? layout(sheet) : null), [ready, layout, sheet]);
  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!ready || !L || !wb) return <div className="p-6 text-slate-500">{t("loadingEngine")}</div>;

  const R = L.roles;
  const headRows = L.rows.filter((r) => r.kind === "title" || r.kind === "head");
  const bodyRows = L.rows.filter((r) => r.kind !== "title" && r.kind !== "head" && r.kind !== "header");
  const sideCells: { row: number; col: number; cell: TemplateCell }[] = [];
  for (const r of L.rows)
    for (const [c, cell] of Object.entries(r.cells)) {
      const col = Number(c);
      if (col > L.bodyMaxCol && !(r.kind === "head" && col <= L.bodyMaxCol)) sideCells.push({ row: r.row, col, cell });
    }

  const totalsCoords = L.totals.map((tt) => ({ label: tt.label, cost: R.cost ? coordOf(R.cost, tt.row) : "", sales: R.sales ? coordOf(R.sales, tt.row) : "" }));

  const isYN = (cell?: TemplateCell) => !!cell && cell.f === undefined && typeof cell.v === "string" && /^[YN]$/i.test(cell.v.trim());

  return (
    <div className="shell">
      {/* 상단 바 */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Link href={`/projects/${projectId}`} className="text-[13px] text-brand hover:underline">
          {t("backToTotal")}
        </Link>
        <h1 className="text-lg font-bold text-slate-900">{L.title}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{sheet}</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-slate-500">{t("legend")}</span>
          <SaveBadge />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {/* 치수/기본 설정 */}
          <section className="card p-3">
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("dimensions")}</h2>
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
              {headRows.map((r) => {
                const cols = Object.keys(r.cells)
                  .map(Number)
                  .filter((c) => c <= L.bodyMaxCol)
                  .sort((a, b) => a - b);
                if (!cols.length) return null;
                if (r.kind === "title") return null;
                return (
                  <div key={r.row} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-1 text-[13px]">
                    {cols.map((c) => {
                      const cell = r.cells[c];
                      const coord = coordOf(c, r.row);
                      const isLabel = cell.f === undefined && typeof cell.v === "string" && !L.referenced.has(coord);
                      if (isLabel && !isYN(cell))
                        return (
                          <span key={c} className="text-slate-600">
                            {fmtValue(cell.v)}
                          </span>
                        );
                      return (
                        <span key={c} className="inline-flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">{coord}</span>
                          <span className="w-28">
                            <AutoCell sheet={sheet} coord={coord} textEditable />
                          </span>
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 본문 */}
          <section className="card overflow-x-auto">
            <table className="tbl w-full">
              <thead>
                <tr>
                  <th className="w-16">{t("ref")}</th>
                  {R.sage && <th className="w-20">Sage</th>}
                  <th>{t("description")}</th>
                  {R.notes && <th className="w-40">{t("notes")}</th>}
                  {(R.yn || R.unit) && <th className="w-12">Y/N</th>}
                  {R.unit && <th className="w-12">{t("unit")}</th>}
                  <th className="w-24 text-right">{t("qty")}</th>
                  {R.unitCost && <th className="w-24 text-right">{t("unitCost")}</th>}
                  <th className="w-28 text-right">{t("cost")}</th>
                  {R.sales && <th className="w-28 text-right">{t("sales")}</th>}
                  {R.offer && <th className="w-28 text-right">Offer</th>}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((r) => {
                  if (!Object.keys(r.cells).some((x) => Number(x) <= L.bodyMaxCol && Number(x) !== R.block)) return null;
                  const c = (col?: number) => (col ? r.cells[col] : undefined);
                  const co = (col?: number) => (col ? coordOf(col, r.row) : "");
                  const ncols =
                    3 + (R.sage ? 1 : 0) + (R.notes ? 1 : 0) + (R.yn || R.unit ? 1 : 0) + (R.unit ? 1 : 0) + (R.unitCost ? 1 : 0) + (R.sales ? 1 : 0) + (R.offer ? 1 : 0);
                  if (r.kind === "section" || r.kind === "note") {
                    const descCell = c(R.desc) ?? c(R.notes);
                    const qtyCell = c(R.qty);
                    const other = Object.keys(r.cells)
                      .map(Number)
                      .filter((x) => x !== R.desc && x !== R.notes && x !== R.qty && x <= L.bodyMaxCol && x !== R.block);
                    return (
                      <tr key={r.row} className={r.kind}>
                        <td className="text-[10px] text-slate-400">{r.row}</td>
                        <td colSpan={ncols - 2} className="whitespace-pre-wrap">
                          {descCell ? (descCell.f ? fmtValue(wb.get(sheet, co(R.desc ?? R.notes))) : fmtValue(descCell.v)) : ""}
                          {c(R.notes) && descCell !== c(R.notes) && <span className="ml-2 font-normal text-slate-500">{fmtValue(wb.get(sheet, co(R.notes)))}</span>}
                          {other.map((x) => (
                            <span key={x} className="ml-3 inline-flex items-center gap-1 font-normal">
                              <span className="text-[10px] text-slate-400">{coordOf(x, r.row)}</span>
                              <AutoCell sheet={sheet} coord={coordOf(x, r.row)} textEditable={false} />
                            </span>
                          ))}
                        </td>
                        <td className="text-right text-slate-500">{qtyCell?.f ? fmtValue(wb.get(sheet, co(R.qty)), "d2") : ""}</td>
                      </tr>
                    );
                  }
                  if (r.kind === "subtotal" || r.kind === "total") {
                    const label = fmtValue(c(R.desc)?.v ?? c(R.notes)?.v) || (r.kind === "total" ? "Total" : "Subtotal");
                    return (
                      <tr key={r.row} className={r.kind}>
                        <td className="text-[10px] text-slate-400">{r.row}</td>
                        <td colSpan={ncols - (2 + (R.unitCost ? 1 : 0) + (R.sales ? 1 : 0) + (R.offer ? 1 : 0))}>{label}</td>
                        <td className="text-right text-slate-500">{c(R.qty) ? fmtValue(wb.get(sheet, co(R.qty)), "d2") : ""}</td>
                        {R.unitCost && <td></td>}
                        <td className="text-right">
                          <Calc value={wb.get(sheet, co(R.cost))} fmt="eur" />
                        </td>
                        {R.sales && (
                          <td className="text-right">
                            <Calc value={c(R.sales) ? wb.get(sheet, co(R.sales)) : null} fmt="eur" />
                          </td>
                        )}
                        {R.offer && (
                          <td className="text-right">
                            <Calc value={c(R.offer) ? wb.get(sheet, co(R.offer)) : null} fmt="eur" />
                          </td>
                        )}
                      </tr>
                    );
                  }
                  // line
                  const ynCell = c(R.yn);
                  const unitCell = c(R.unit);
                  const ynInUnit = !isYN(ynCell) && isYN(unitCell);
                  const descCell = c(R.desc);
                  const notesCell = c(R.notes);
                  const qtyCell = c(R.qty);
                  const qtyIsInput = !!qtyCell && qtyCell.f === undefined;
                  return (
                    <tr key={r.row} className="hover:bg-sky-50/40">
                      <td className="font-mono text-[11px] text-slate-500">
                        {c(R.ref) && c(R.ref)!.f === undefined ? <CellEditor sheet={sheet} coord={co(R.ref)} kind="text" className="w-16" /> : fmtValue(c(R.ref) ? wb.get(sheet, co(R.ref)) : null)}
                      </td>
                      {R.sage && <td className="text-[11px] text-slate-500">{fmtValue(c(R.sage) ? wb.get(sheet, co(R.sage)) : null)}</td>}
                      <td className="whitespace-pre-wrap">
                        {descCell ? descCell.f ? fmtValue(wb.get(sheet, co(R.desc))) : <CellEditor sheet={sheet} coord={co(R.desc)} kind="text" className="w-full" /> : ""}
                      </td>
                      {R.notes && (
                        <td className="text-[12px] text-slate-500">
                          {notesCell ? notesCell.f ? fmtValue(wb.get(sheet, co(R.notes))) : <CellEditor sheet={sheet} coord={co(R.notes)} kind="text" className="w-full" /> : ""}
                        </td>
                      )}
                      {(R.yn || R.unit) && (
                        <td className="text-center">
                          {isYN(ynCell) && <CellEditor sheet={sheet} coord={co(R.yn)} kind="yn" />}
                          {ynInUnit && <CellEditor sheet={sheet} coord={co(R.unit)} kind="yn" />}
                        </td>
                      )}
                      {R.unit && <td className="text-[12px] text-slate-500">{ynInUnit ? "" : fmtValue(unitCell?.v)}</td>}
                      <td className="text-right">
                        {qtyCell ? (
                          <CellEditor sheet={sheet} coord={co(R.qty)} kind="num" fmt={qtyCell.fmt ?? (qtyIsInput ? undefined : "d2")} step={1} className="w-full justify-end" />
                        ) : null}
                      </td>
                      {R.unitCost && (
                        <td className="text-right">
                          {c(R.unitCost) ? <CellEditor sheet={sheet} coord={co(R.unitCost)} kind="num" fmt="eur2" className="w-full justify-end" /> : null}
                        </td>
                      )}
                      <td className="text-right">
                        <Calc value={wb.get(sheet, co(R.cost))} fmt="eur" />
                      </td>
                      {R.sales && (
                        <td className="text-right">
                          <Calc value={c(R.sales) ? wb.get(sheet, co(R.sales)) : null} fmt="eur" />
                        </td>
                      )}
                      {R.offer && (
                        <td className="text-right">
                          <Calc value={c(R.offer) ? wb.get(sheet, co(R.offer)) : null} fmt="eur" />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {sideCells.length > 0 && (
            <section className="card p-3">
              <button type="button" className="text-[12px] font-semibold text-slate-600" onClick={() => setShowSide((s) => !s)}>
                {showSide ? "▾" : "▸"} {t("sideInfo")} ({sideCells.length})
              </button>
              {showSide && (
                <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0.5 text-[12px] md:grid-cols-2">
                  {sideCells.map(({ row, col, cell }) => (
                    <div key={`${col}-${row}`} className="flex gap-2 border-b border-slate-100 py-0.5">
                      <span className="w-12 shrink-0 font-mono text-[10px] text-slate-400">
                        {numToCol(col)}
                        {row}
                      </span>
                      <span className="whitespace-pre-wrap">{fmtValue(wb.get(sheet, coordOf(col, row)), cell.fmt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* 우측 요약 */}
        <aside className="space-y-4 xl:sticky xl:top-3 xl:self-start">
          <section className="card p-3">
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("summary")}</h2>
            {totalsCoords.map((tt) => (
              <div key={tt.label} className="mb-2">
                <div className="text-[12px] text-slate-600">{tt.label}</div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500">{t("cost")}</span>
                  <b>{fmtEur(wb.get(sheet, tt.cost))}</b>
                </div>
                {tt.sales && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate-500">{t("sales")}</span>
                    <b>{fmtEur(wb.get(sheet, tt.sales))}</b>
                  </div>
                )}
              </div>
            ))}
          </section>
          {L.blocks.length > 0 && (
            <section className="card p-3">
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{t("blockPrices")}</h2>
              <table className="w-full text-[12px]">
                <tbody>
                  {L.blocks.map((b) => (
                    <tr key={b.sumCoord} className="border-b border-slate-100">
                      <td className="py-0.5 text-slate-600">{b.label}</td>
                      <td className="py-0.5 text-right tabular-nums">{fmtEur(wb.get(sheet, b.sumCoord))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

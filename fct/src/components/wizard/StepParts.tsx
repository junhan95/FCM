"use client";

import { useState } from "react";
import { useProject } from "../ProjectStore";
import { Calc, CellEditor } from "../cells";
import { fmtEur, fmtValue } from "@/lib/format";
import { coordOf } from "@/engine/layout";
import type { LayoutRow, SheetLayout } from "@/engine/layout";
import type { TemplateCell } from "@/engine/types";
import { EXTRA_ROWS, PART_CATEGORY_LABEL, PART_CATEGORY_ORDER, PartCategory, ROOM_ROWS, SPECIAL_PART_ROWS, partCategory } from "@/lib/wizard";
import ChamberDimensions from "./ChamberDimensions";
import FireGasCard from "./FireGasCard";
import MonitoringCard from "./MonitoringCard";
import ExternalItemsCard from "./ExternalItemsCard";
import AddPartDialog from "./AddPartDialog";
import { findSpareRows, pickSpareRow } from "@/lib/spare-rows";
import { hiddenCoord, placementCoord, readHidden, readPlacement } from "@/lib/placement";

const T = "Total";

function sourceSheet(f?: string): string | null {
  if (!f) return null;
  const m = /^'([^']+)'!|^([A-Za-z][A-Za-z0-9\- ]*?)!/.exec(f);
  return m ? (m[1] ?? m[2]) : null;
}

/** 구성품 표의 공통 열 폭 — 카드·섹션이 나뉘어도 세로줄이 일직선이 되게 한다 */
const PART_COLS = ["92px", "auto", "56px", "56px", "104px", "108px", "116px", "40px"];
const PartCols = () => (
  <colgroup>
    {PART_COLS.map((w, i) => (
      <col key={i} style={{ width: w }} />
    ))}
  </colgroup>
);

const isYN = (c?: TemplateCell) => !!c && c.f === undefined && typeof c.v === "string" && /^[YN]$/i.test(c.v.trim());

/** 사용자가 직접 정하는 행인지 — Y/N 스위치가 있거나 수량·단가가 리터럴 */
function isChoiceRow(r: LayoutRow, L: SheetLayout) {
  const R = L.roles;
  const yn = R.yn ? r.cells[R.yn] : undefined;
  const unit = R.unit ? r.cells[R.unit] : undefined;
  if (isYN(yn) || isYN(unit)) return true;
  const q = R.qty ? r.cells[R.qty] : undefined;
  if (q && q.f === undefined && typeof q.v === "number") return true;
  const g = R.unitCost ? r.cells[R.unitCost] : undefined;
  if (g && g.f === undefined && typeof g.v === "number") return true;
  return false;
}

/** 이 행이 견적에 포함되었는지 (수량 > 0) */
function rowIncluded(r: LayoutRow, L: SheetLayout, get: (c: string) => unknown) {
  const R = L.roles;
  if (!R.qty) return false;
  const v = get(coordOf(R.qty, r.row));
  return typeof v === "number" && v !== 0;
}

export default function StepParts({ chamberRows, onPickChamber }: { chamberRows: number[]; onPickChamber: () => void }) {
  const { wb, t, lang, layout, ready, version, setCell, overrides, canEdit } = useProject();
  const [sheet, setSheet] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  /** 구성품 추가 다이얼로그가 열린 섹션 */
  const [adding, setAdding] = useState<{ name: string; from: number; to: number; refs: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** 제품 교체 다이얼로그가 열린 행 */
  const [swapping, setSwapping] = useState<{ row: number; ref: string; section: string } | null>(null);
  /** 제거 확인 모달이 열린 행 */
  const [removing, setRemoving] = useState<{ row: number; label: string; added: boolean; cat: PartCategory } | null>(null);
  void version;

  if (!wb || !ready) return null;

  // 견적에 포함된 시트 목록 (메인 챔버 + 수량 > 0 인 부속실/추가 항목)
  const tplTotal = wb.template.sheets[T].cells;
  // id 는 탭 구분용 — 대부분 시트 이름이지만, 전용 시트가 없는 행은 따로 붙인다
  const sheets: { id: string; row: number; name: string; sheet: string | null }[] = [];
  const addSheet = (r: number) => {
    const qty = wb.get(T, `C${r}`);
    if (typeof qty !== "number" || qty <= 0) return;
    const name = String(wb.get(T, `B${r}`) ?? "").trim();
    const special = SPECIAL_PART_ROWS[r];
    if (special) {
      if (special.sheet && !wb.template.sheets[special.sheet]) return;
      sheets.push({ id: special.id, row: r, name, sheet: special.sheet });
      return;
    }
    const s = sourceSheet(tplTotal[`E${r}`]?.f);
    if (!s || !wb.template.sheets[s]) return;
    if (sheets.some((x) => x.id === s)) return; // 여러 행이 한 시트를 가리키면 탭은 하나만
    sheets.push({ id: s, row: r, name, sheet: s });
  };
  for (const r of [...chamberRows, ...ROOM_ROWS, ...EXTRA_ROWS]) addSheet(r);

  const activeId = sheet && sheets.some((s) => s.id === sheet) ? sheet : (sheets[0]?.id ?? null);
  const activeTab = sheets.find((s) => s.id === activeId) ?? null;
  const active = activeTab?.sheet ?? null;

  if (!chamberRows.length) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-[14px] text-slate-600">{t("noChamberYet")}</p>
        <button type="button" className="btn" onClick={onPickChamber}>
          {t("goPickChamber")} →
        </button>
      </div>
    );
  }

  const isSpecial = activeTab ? !!SPECIAL_PART_ROWS[activeTab.row] : false;

  const tabs = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] text-slate-500">{t("partsFor")}:</span>
      {sheets.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setSheet(s.id)}
          className={`chip !px-3 !py-1.5 !text-[13px] ${s.id === activeId ? "chip-on" : ""}`}
        >
          {s.name}
        </button>
      ))}
      {!isSpecial && (
        <label className="ml-auto flex items-center gap-1.5 text-[12px] text-slate-600">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          {t("showAllRows")}
        </label>
      )}
    </div>
  );

  // 매입 항목(Fire & Gas · Purchased Parts · E-Drive)은 챔버 구성품과 표 모양이 달라 따로 그린다
  if (activeTab && isSpecial) {
    return (
      <div className="space-y-4">
        {tabs}
        {activeTab.row === 53 && <MonitoringCard />}
        {activeTab.row === 58 && <FireGasCard />}
        {[57, 59, 60].includes(activeTab.row) && <ExternalItemsCard row={activeTab.row} title={activeTab.name} />}
      </div>
    );
  }

  const L = layout(active!);
  const R = L.roles;
  const get = (c: string) => wb.get(active!, c);

  // 섹션 → 카테고리별로 묶기
  // 직접 추가한 행이 어느 목록에 보여야 하는지 (계산 위치와 표시 위치를 분리한다)
  const placed = readPlacement(overrides, active!);
  const hidden = readHidden(overrides, active!);

  const bySection: { name: string; from: number; to: number; hidden: number; rows: LayoutRow[] }[] = [];
  let cur: { name: string; from: number; to: number; hidden: number; rows: LayoutRow[] } | null = null;
  const adopted = new Map<number, LayoutRow[]>();
  for (const r of L.rows) {
    if (r.kind === "section") {
      const d = R.desc ? r.cells[R.desc] : undefined;
      const name = d && typeof d.v === "string" ? d.v.trim() : "";
      cur = { name: name || "—", from: r.row, to: r.row, hidden: 0, rows: [] };
      bySection.push(cur);
    } else if (cur) {
      cur.to = Math.max(cur.to, r.row);
      if (r.kind !== "line") continue;
      if (hidden.has(r.row)) {
        cur.hidden++;
        continue;
      }
      const target = placed.get(r.row);
      if (target !== undefined && target !== cur.from) {
        // 다른 목록에 보여야 하는 행 — 물리적 섹션에서는 뺀다
        const arr = adopted.get(target) ?? [];
        arr.push(r);
        adopted.set(target, arr);
      } else {
        cur.rows.push(r);
      }
    }
  }
  for (const sec of bySection) {
    const extra = adopted.get(sec.from);
    if (extra) sec.rows = [...sec.rows, ...extra];
  }

  /** 이 섹션에서 '+' 로 고른 품목이 실제로 들어갈 예비 행 */
  const slotFor = (sec: { name: string; from: number; to: number }) => {
    const tpl = wb.template.sheets[active!];
    const cat = partCategory(sec.name);
    const sameCat = bySection.filter((x) => partCategory(x.name) === cat);
    const catRange = sameCat.length
      ? { from: Math.min(...sameCat.map((x) => x.from)), to: Math.max(...sameCat.map((x) => x.to)) }
      : undefined;
    const slot = pickSpareRow(
      findSpareRows(tpl),
      (row) => {
        const v = wb.get(active!, coordOf(1, row));
        return v !== 0 && v !== null && v !== "" && v !== undefined;
      },
      { from: sec.from, to: sec.to },
      catRange,
    );
    if (!slot) return null;
    const host = bySection.find((x) => slot.row >= x.from && slot.row <= x.to);
    return { ...slot, section: host?.name ?? sec.name };
  };

  const byCat = new Map<PartCategory, typeof bySection>();
  for (const s of bySection) {
    if (!s.rows.length) continue;
    const cat = partCategory(s.name);
    const arr = byCat.get(cat) ?? [];
    arr.push(s);
    byCat.set(cat, arr);
  }

  return (
    <div className="space-y-4">
      {tabs}

      {/* 치수 — 항상 구성품 목록 가장 위 */}
      <ChamberDimensions sheet={active!} title={sheets.find((s) => s.sheet === active)?.name ?? active!} />

      {/* 카테고리 카드 */}
      <div className="space-y-3">
        {PART_CATEGORY_ORDER.map((cat) => {
          const secs = byCat.get(cat);
          if (!secs) return null;
          const visibleSecs = secs
            .map((s) => ({ ...s, rows: s.rows.filter((r) => showAll || isChoiceRow(r, L)) }))
            .filter((s) => s.rows.length);
          if (!visibleSecs.length) return null;

          const includedCount = secs.reduce((n, s) => n + s.rows.filter((r) => rowIncluded(r, L, get)).length, 0);
          const hiddenCount = secs.reduce((n, s) => n + s.hidden, 0);
          const catCost = secs.reduce((sum, s) => {
            for (const r of s.rows) {
              const v = R.sales ? get(coordOf(R.sales, r.row)) : null;
              if (typeof v === "number") sum += v;
            }
            return sum;
          }, 0);
          const openKey = `${active}|${cat}`;
          const isOpen = open[openKey] ?? includedCount > 0;

          return (
            <section key={cat} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [openKey]: !isOpen }))}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="text-[15px] text-slate-400">{isOpen ? "▾" : "▸"}</span>
                <span className="text-[14px] font-semibold text-slate-800">
                  {lang === "ko" ? PART_CATEGORY_LABEL[cat].ko : PART_CATEGORY_LABEL[cat].en}
                </span>
                {lang === "ko" && <span className="text-[11px] text-slate-400">{PART_CATEGORY_LABEL[cat].en}</span>}
                {includedCount > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    {includedCount} {t("itemsIncluded")}
                  </span>
                )}
                {hiddenCount > 0 && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {t("hiddenCount")} {hiddenCount}
                  </span>
                )}
                <span className="ml-auto text-[13px] font-bold tabular-nums text-slate-700">{fmtEur(catCost)}</span>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100">
                  {visibleSecs.map((s) => (
                    <div key={s.name + s.rows[0].row} className="border-b border-slate-100 last:border-b-0">
                      <div className="flex items-center gap-2 bg-slate-50/70 px-4 py-1.5 text-[12px] font-semibold text-slate-600">
                        {s.name}
                        {s.hidden > 0 && canEdit && (
                          <button
                            type="button"
                            title={t("restoreHidden")}
                            onClick={() => {
                              for (let x = s.from; x <= s.to; x++) {
                                const prev = hidden.get(x);
                                if (prev === undefined) continue;
                                if (R.qty) setCell(active!, coordOf(R.qty, x), prev);
                                const hc = hiddenCoord(active!, x);
                                setCell(hc.sheet, hc.coord, undefined);
                              }
                            }}
                            className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-300 hover:text-slate-700"
                          >
                            {t("hiddenCount")} {s.hidden} ↺
                          </button>
                        )}
                        {canEdit && (
                        <button
                          type="button"
                          title={t("addPartTitle")}
                          aria-label={t("addPart")}
                          onClick={() =>
                            setAdding({
                              name: s.name,
                              from: s.from,
                              to: s.to,
                              refs: s.rows.map((r) => String(R.ref ? (get(coordOf(R.ref, r.row)) ?? "") : "")).filter(Boolean),
                            })
                          }
                          className="flex h-[18px] w-[18px] items-center justify-center rounded border border-slate-300 bg-white text-[13px] leading-none text-slate-400 hover:border-brand hover:text-brand"
                        >
                          +
                        </button>
                        )}
                      </div>
                      <table className="tbl tbl-fixed w-full">
                        <PartCols />
                        <tbody>
                          {s.rows.map((r) => {
                            const c = (col?: number) => (col ? r.cells[col] : undefined);
                            const co = (col?: number) => (col ? coordOf(col, r.row) : "");
                            const descCell = c(R.desc);
                            const notesCell = c(R.notes);
                            const ynCell = c(R.yn);
                            const unitCell = c(R.unit);
                            const ynInUnit = !isYN(ynCell) && isYN(unitCell);
                            const included = rowIncluded(r, L, get);
                            // Ref 가 리터럴이고 품명이 그 Ref 를 VLOOKUP 하는 행만 제품을 바꿀 수 있다
                            const refCell = c(R.ref);
                            const swappable =
                              R.ref !== undefined &&
                              !!refCell &&
                              refCell.f === undefined &&
                              !!descCell?.f &&
                              /VLOOKUP/i.test(descCell.f) &&
                              new RegExp(`\\b${coordOf(R.ref, r.row)}\\b`, "i").test(descCell.f);
                            const refOverridden = R.ref !== undefined && overrides[active!]?.[co(R.ref)] !== undefined;
                            const isSpare = refCell?.f === undefined && refCell?.v === 0;
                            const desc = descCell ? (descCell.f ? fmtValue(get(co(R.desc))) : fmtValue(descCell.v)) : "";
                            return (
                              <tr key={r.row} className={included ? "bg-red-50/30" : ""}>
                                <td className="font-mono text-[10px] text-slate-400">
                                  <span className="inline-flex items-center gap-0.5">
                                    {fmtValue(c(R.ref) ? get(co(R.ref)) : null)}
                                    {swappable && canEdit && (
                                      <button
                                        type="button"
                                        title={t("swapPartTitle")}
                                        aria-label={t("swapPart")}
                                        onClick={() => setSwapping({ row: r.row, ref: String(get(co(R.ref)) ?? ""), section: s.name })}
                                        className={`rounded px-0.5 leading-none ${
                                          refOverridden
                                            ? "text-amber-500 hover:bg-amber-100 hover:text-amber-700"
                                            : "text-slate-300 hover:bg-sky-100 hover:text-sky-700"
                                        }`}
                                      >
                                        <svg viewBox="0 0 8 5" className="h-[5px] w-[8px]" aria-hidden>
                                          <path d="M0 0 L4 5 L8 0 Z" fill="currentColor" />
                                        </svg>
                                      </button>
                                    )}
                                    {refOverridden && !isSpare && (
                                      <button
                                        type="button"
                                        title={t("restoreProduct")}
                                        onClick={() => {
                                          setCell(active!, co(R.ref), undefined);
                                          if (R.unit) setCell(active!, co(R.unit), undefined);
                                        }}
                                        className="rounded px-1 text-[11px] leading-none text-amber-600 hover:bg-amber-100"
                                      >
                                        ↺
                                      </button>
                                    )}
                                  </span>
                                </td>
                                <td className="whitespace-pre-wrap text-[12px]">
                                  <span className={included ? "font-medium text-slate-900" : "text-slate-700"}>{desc}</span>
                                  {notesCell && (
                                    <span className="ml-2 text-[11px] text-slate-400">{notesCell.f ? fmtValue(get(co(R.notes))) : fmtValue(notesCell.v)}</span>
                                  )}
                                </td>
                                <td className="text-center">
                                  {isYN(ynCell) && <CellEditor sheet={active!} coord={co(R.yn)} kind="yn" />}
                                  {ynInUnit && <CellEditor sheet={active!} coord={co(R.unit)} kind="yn" />}
                                </td>
                                <td className="text-[11px] text-slate-400">{ynInUnit ? "" : fmtValue(unitCell?.v)}</td>
                                <td>
                                  {c(R.qty) && <CellEditor sheet={active!} coord={co(R.qty)} kind="num" fmt={c(R.qty)!.f ? "d2" : undefined} step={1} className="w-full justify-end" />}
                                </td>
                                <td className="text-right">
                                  {c(R.unitCost) && <CellEditor sheet={active!} coord={co(R.unitCost)} kind="num" fmt="eur2" className="w-full justify-end" />}
                                </td>
                                <td className="text-right">
                                  <Calc value={R.sales ? get(co(R.sales)) : null} fmt="eur" />
                                </td>
                                <td className="text-right">
                                  {canEdit && (
                                  <button
                                    type="button"
                                    title={t("removeRow")}
                                    aria-label={t("removeRow")}
                                    onClick={() => setRemoving({ row: r.row, label: desc || String(get(co(R.ref)) ?? ""), added: isSpare, cat })}
                                    className="rounded px-1 py-0.5 text-[12px] leading-none text-slate-300 hover:bg-red-50 hover:text-brand"
                                  >
                                    ✕
                                  </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {notice && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded bg-slate-800 px-4 py-2 text-[12px] text-white shadow-lg" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}

      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setRemoving(null)}>
          <div className="card w-[440px] p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">{t("removeRowTitle")}</h2>
            <div className="my-3 rounded bg-slate-50 px-3 py-2 text-[13px] font-medium text-slate-800">{removing.label}</div>
            <p className="text-[12px] leading-relaxed text-slate-600">{removing.added ? t("removeRowAdded") : t("removeRowBody")}</p>
            <button
              type="button"
              className="btn-danger mt-4 w-full justify-center"
              onClick={() => {
                const row = removing.row;
                if (removing.added) {
                  // '+' 로 넣은 줄 — 완전히 비운다
                  if (R.ref) setCell(active!, coordOf(R.ref, row), undefined);
                  if (R.qty) setCell(active!, coordOf(R.qty, row), undefined);
                  if (R.unit) setCell(active!, coordOf(R.unit, row), undefined);
                  const pc = placementCoord(active!, row);
                  setCell(pc.sheet, pc.coord, undefined);
                } else {
                  // 목록 품목 — 직전 수량을 적어 두고 0 으로 만든 뒤 감춘다 (그대로 되돌릴 수 있다)
                  const q = R.qty ? get(coordOf(R.qty, row)) : null;
                  const hc = hiddenCoord(active!, row);
                  setCell(hc.sheet, hc.coord, typeof q === "number" ? q : 0);
                  if (R.qty) setCell(active!, coordOf(R.qty, row), 0);
                }
                // 마지막 선택 품목을 뺐다고 카테고리 카드가 닫혀 버리지 않게 열어 둔다
                setOpen((o) => ({ ...o, [`${active}|${removing.cat}`]: true }));
                setRemoving(null);
              }}
            >
              {t("removeConfirm")}
            </button>
            <button type="button" className="btn-secondary mt-2 w-full justify-center" onClick={() => setRemoving(null)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {swapping && (
        <AddPartDialog
          mode="swap"
          sheet={active!}
          section={swapping.section}
          existingRefs={[]}
          currentRef={swapping.ref}
          slot={null}
          onClose={() => setSwapping(null)}
          onPick={(ref, unit) => {
            if (R.ref) setCell(active!, coordOf(R.ref, swapping.row), ref);
            if (R.unit && unit) setCell(active!, coordOf(R.unit, swapping.row), unit);
            setSwapping(null);
            setNotice(`${t("swapPart")} — ${swapping.ref} → ${ref}`);
            setTimeout(() => setNotice(null), 3000);
          }}
        />
      )}

      {adding && (
        <AddPartDialog
          sheet={active!}
          section={adding.name}
          existingRefs={adding.refs}
          slot={slotFor(adding)}
          onClose={() => setAdding(null)}
          onPick={(ref, unit) => {
            const slot = slotFor(adding);
            if (!slot) return;
            setCell(active!, coordOf(1, slot.row), ref);
            if (R.qty) setCell(active!, coordOf(R.qty, slot.row), 1);
            if (R.unit && unit) setCell(active!, coordOf(R.unit, slot.row), unit);
            // 계산은 예비 행에서 하되, 목록에는 '+' 를 누른 그 섹션에 보이게 한다
            const pc = placementCoord(active!, slot.row);
            setCell(pc.sheet, pc.coord, adding.from);
            setOpen((o) => ({ ...o, [`${active}|${partCategory(adding.name)}`]: true }));
            setAdding(null);
            setNotice(`${t("addPartDone")} — ${adding.name}`);
            setTimeout(() => setNotice(null), 3000);
          }}
        />
      )}

      {/* 합계 */}
      <section className="card flex flex-wrap items-center gap-6 px-4 py-3">
        {L.totals.map((tt) => (
          <div key={tt.row}>
            <div className="text-[11px] text-slate-500">{tt.label}</div>
            <div className="text-[15px] font-bold tabular-nums text-slate-900">{fmtEur(R.sales ? get(coordOf(R.sales, tt.row)) : null)}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

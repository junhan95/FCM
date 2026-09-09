"use client";

import { useMemo, useState } from "react";
import { useProject } from "../ProjectStore";
import { fmtEur } from "@/lib/format";
import { buildPriceTree, PriceRowView } from "@/lib/price-tree";
import type { PriceRow } from "@/engine/types";

const refKey = (v: unknown) => String(v ?? "").trim();

/** PriceRow(엔진용) → 카테고리 트리가 쓰는 모양 */
function toView(p: PriceRow): PriceRowView {
  return {
    id: p.row,
    row: p.row,
    ref: p.ref,
    sage: p.sage == null ? "" : String(p.sage),
    item: p.item == null ? "" : String(p.item),
    description: p.description == null ? "" : String(p.description),
    unit: p.unit == null ? "" : String(p.unit),
    price: typeof p.price === "number" ? p.price : null,
    priceText: p.price == null ? "" : String(p.price),
    delivery: p.delivery == null ? "" : String(p.delivery),
    priceDate: p.priceDate == null ? "" : String(p.priceDate),
    category: p.category ?? "",
    isHeader: !!p.isHeader,
  };
}

/**
 * 섹션에 가격 DB 품목을 직접 추가하는 다이얼로그.
 * 카테고리는 그 섹션이 이미 쓰고 있는 Ref 들의 가격 DB 카테고리로 미리 골라 둔다 —
 * 이름을 짐작하지 않고 데이터로 정한다.
 */
export default function AddPartDialog({
  sheet,
  section,
  existingRefs,
  slot,
  mode = "add",
  currentRef,
  onPick,
  onClose,
}: {
  sheet: string;
  section: string;
  existingRefs: string[];
  /** add 모드에서 계산에 쓸 예비 행 — 없으면 추가할 수 없다. 표시 위치는 '+' 를 누른 섹션이다. */
  slot: { row: number } | null;
  /** add = 새 줄 추가 · swap = 이 줄의 제품을 다른 제품으로 교체 */
  mode?: "add" | "swap";
  /** swap 모드에서 지금 들어 있는 Ref */
  currentRef?: string;
  onPick: (ref: string | number, unit: string) => void;
  onClose: () => void;
}) {
  const { prices, t } = useProject();
  const [q, setQ] = useState("");

  const tree = useMemo(() => buildPriceTree(prices.map(toView)), [prices]);

  // 교체할 때는 지금 들어 있는 제품의 카테고리, 추가할 때는 섹션이 이미 쓰는 Ref 들의 카테고리
  const defaultCat = useMemo(() => {
    const byRef = new Map<string, string>();
    for (const c of tree) for (const g of c.groups) for (const e of g.entries) byRef.set(refKey(e.main.ref), c.key);
    if (mode === "swap" && currentRef) {
      const k = byRef.get(refKey(currentRef));
      if (k) return k;
    }
    const tally = new Map<string, number>();
    for (const r of existingRefs) {
      const k = byRef.get(r);
      if (k) tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    let best = "";
    let n = 0;
    for (const [k, v] of tally) {
      if (v > n) {
        best = k;
        n = v;
      }
    }
    return best;
  }, [tree, existingRefs, mode, currentRef]);

  const [cat, setCat] = useState<string>(defaultCat);
  const active = cat || defaultCat;

  const qq = q.trim().toLowerCase();
  const rows = useMemo(() => {
    const out: { ref: string | number; item: string; desc: string; unit: string; price: number | null; group: string }[] = [];
    for (const c of tree) {
      if (active && c.key !== active) continue;
      for (const g of c.groups)
        for (const e of g.entries) {
          const r = e.main;
          if (!refKey(r.ref) || refKey(r.ref) === "0") continue;
          const text = `${refKey(r.ref)} ${r.item} ${r.description}`.toLowerCase();
          if (qq && !text.includes(qq)) continue;
          out.push({ ref: r.ref as string | number, item: r.item, desc: r.description, unit: r.unit, price: r.price, group: g.name });
        }
    }
    return out;
  }, [tree, active, qq]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-[900px] flex-col p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <h2 className="card-title">{mode === "swap" ? t("swapPart") : t("addPart")}</h2>
          <span className="text-[12px] text-slate-500">
            {sheet} · {section}
          </span>
          <button type="button" className="ml-auto text-[13px] text-slate-400 hover:text-brand" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 어디에 들어가는지 먼저 알린다 — 템플릿은 섹션의 1/3 에만 빈 행을 두었다 */}
        {mode === "swap" ? (
          <p className="mb-2 rounded bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
            {t("swapPartHint")} <b className="font-mono">{currentRef}</b>
          </p>
        ) : slot === null ? (
          <p className="mb-2 rounded bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{t("addPartNoSpare")}</p>
        ) : (
          <p className="mb-2 rounded bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
            <b>{section}</b> {t("addPartInto")}
            <span className="ml-2 text-[11px] text-emerald-700/70">
              ({t("addPartUsing")} {t("addPartRow")} {slot.row})
            </span>
          </p>
        )}

        <div className="mb-2 flex flex-wrap gap-2">
          <select className="field !w-[24rem]" value={active} onChange={(e) => setCat(e.target.value)}>
            <option value="">{t("all")}</option>
            {tree.map((c) => (
              <option key={c.key} value={c.key}>
                {c.no}. {c.name} ({c.count})
              </option>
            ))}
          </select>
          <input className="field !w-64" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <span className="self-center text-[12px] text-slate-500">
            {rows.length} {t("itemsCount")}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded border border-slate-200">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-[13px] text-slate-500">{t("noResults")}</p>
          ) : (
            <table className="tbl w-full text-[12px]">
              <tbody>
                {rows.slice(0, 400).map((r, i) => (
                  <tr
                    key={`${refKey(r.ref)}-${i}`}
                    className={`${mode === "swap" || slot ? "cursor-pointer hover:bg-sky-50" : "cursor-not-allowed opacity-50"} ${
                      mode === "swap" && refKey(r.ref) === refKey(currentRef) ? "bg-sky-50 font-semibold" : ""
                    }`}
                    onClick={() => (mode === "swap" || slot) && onPick(r.ref, r.unit)}
                  >
                    <td className="w-20 font-mono text-[11px] text-slate-500">{refKey(r.ref)}</td>
                    <td className="text-[12px] text-slate-800">
                      {r.item}
                      {r.desc && <span className="ml-2 text-[11px] text-slate-400">{r.desc}</span>}
                    </td>
                    <td className="w-14 text-[11px] text-slate-400">{r.unit}</td>
                    <td className="w-24 text-right font-medium tabular-nums text-slate-700">{fmtEur(r.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > 400 && <div className="p-2 text-[12px] text-slate-500">… {rows.length - 400} more — {t("search")}</div>}
        </div>

        <p className="mt-2 text-[11px] text-slate-400">{mode === "swap" ? t("swapPartNote") : t("addPartHint")}</p>
      </div>
    </div>
  );
}

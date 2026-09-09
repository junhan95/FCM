/**
 * Monitoring System — 엑셀 원본 `Monitoring` 탭 (공급사: MK Systemtechnik).
 *
 *   6행    머리글 (Ref prices · Sage no. · Description · Further details · Qty · Unit cost · Total cost · Sales)
 *   8행    Monitoring Equipment - Standard Line    (E8  = Y/N)  … 소계 50행
 *   53행   Monitoring Equipment - Low Price Line   (E53 = Y/N)  … 소계 93행
 *   96행   Additional Equipment                    (E96 = Y/N)  … 소계 112행
 *   114행  Freight & Packaging                     (E114= Y/N)  … 소계 120행
 *   122행  TOTAL Monitoring = 소계 4개의 합         → Total 시트 53행이 받아 간다
 *
 * 앞의 두 블록은 같은 장비의 상위/보급형이라 **둘 중 하나만** 고른다.
 */

import type { TemplateSheet } from "@/engine/types";

export const MON_SHEET = "Monitoring";
/** Total 시트에서 이 시트를 받는 행 — "Monitoring Equipment" */
export const MON_TOTAL_ROW = 53;

export const MON_COL = {
  ref: "A",
  sage: "B",
  desc: "C",
  detail: "D",
  flag: "E",
  qty: "F",
  unitCost: "G",
  totalCost: "H",
  sales: "I",
} as const;

export interface MonRow {
  row: number;
  kind: "group" | "item";
  /** 엑셀에 원가 수식이 빠져 있어 금액이 잡히지 않는 줄 */
  broken?: boolean;
}

export interface MonBlock {
  /** 블록 머리글 행 */
  row: number;
  title: string;
  /** Y/N 스위치 셀 */
  flagCoord: string;
  rows: MonRow[];
  subtotalRow: number | null;
  /** 상위/보급형 중 하나만 고르는 블록인지 */
  lineChoice: boolean;
}

export interface MonForm {
  headRow: number;
  factorCoord: string;
  negoCoord: string;
  supplier: string;
  blocks: MonBlock[];
  totalRow: number | null;
}

const LINE_RE = /standard line|low price line|budget line/i;

export function buildMonitoring(tpl: TemplateSheet): MonForm | null {
  const cell = (col: string, row: number) => tpl.cells[`${col}${row}`];
  const lit = (col: string, row: number) => {
    const c = cell(col, row);
    return c && c.f === undefined && typeof c.v === "string" ? c.v.trim() : "";
  };
  /** 원가 = 수량 × 단가 인 줄 */
  const hasCost = (row: number) => new RegExp(`^\\s*F${row}\\s*\\*\\s*G${row}\\s*$`, "i").test(cell(MON_COL.totalCost, row)?.f ?? "");
  /** 원가 수식이 빠져 있어도 수량·단가가 있으면 품목 줄이다 (엑셀 14행) */
  const isItem = (row: number) => {
    if (hasCost(row)) return true;
    const q = cell(MON_COL.qty, row);
    const u = cell(MON_COL.unitCost, row);
    return !!q && q.f === undefined && typeof q.v === "number" && !!u?.f;
  };
  const isSum = (row: number) => /SUM\(/i.test(cell(MON_COL.totalCost, row)?.f ?? "");
  const isTotal = (row: number) => /^total\b/i.test(lit(MON_COL.desc, row)) && !!cell(MON_COL.totalCost, row)?.f;

  const form: MonForm = {
    headRow: 6,
    factorCoord: "G4",
    negoCoord: "I4",
    supplier: lit(MON_COL.desc, 2),
    blocks: [],
    totalRow: null,
  };

  let cur: MonBlock | null = null;

  for (let row = 1; row <= tpl.maxRow; row++) {
    const a = lit(MON_COL.ref, row);
    const c = lit(MON_COL.desc, row);
    const d = lit(MON_COL.detail, row);

    if (a === "Ref prices") {
      form.headRow = row;
      continue;
    }
    // 블록 머리글 — "Quote >>" 와 Y/N 스위치가 붙어 있다
    if (d.startsWith("Quote") && cell(MON_COL.flag, row)) {
      cur = {
        row,
        title: c,
        flagCoord: `${MON_COL.flag}${row}`,
        rows: [],
        subtotalRow: null,
        lineChoice: LINE_RE.test(c),
      };
      form.blocks.push(cur);
      continue;
    }
    if (isTotal(row)) {
      form.totalRow = row;
      continue;
    }
    if (isSum(row)) {
      if (cur) cur.subtotalRow = row;
      continue;
    }
    if (!cur) continue;
    if (isItem(row)) {
      cur.rows.push({ row, kind: "item", broken: !hasCost(row) });
      continue;
    }
    // 금액이 없는데 품명이 있으면 소제목 (Fix Camera · Optic Fibers …)
    if (c && !cell(MON_COL.qty, row)) cur.rows.push({ row, kind: "group" });
  }

  return form.blocks.length ? form : null;
}

/** 지금 고른 라인 블록 (없으면 null) */
export function selectedLine(form: MonForm, isOn: (coord: string) => boolean): MonBlock | null {
  return form.blocks.find((b) => b.lineChoice && isOn(b.flagCoord)) ?? null;
}

/** 블록의 원가 합 — Y/N 스위치와 무관하게 계산해 두 라인을 견줄 수 있게 한다 */
export function blockCost(block: MonBlock, get: (coord: string) => unknown): number {
  let sum = 0;
  for (const r of block.rows) {
    if (r.kind !== "item") continue;
    const v = get(`${MON_COL.totalCost}${r.row}`);
    if (typeof v === "number" && Number.isFinite(v)) sum += v;
  }
  return sum;
}

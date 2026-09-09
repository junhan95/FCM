/**
 * "Purchase Parts (Dyno,…)" — 엑셀 원본의 `Purchased Parts` 탭.
 *
 * 이 탭은 Price DB 가 아니라 **외부 공급사 견적을 그대로 옮겨 적는 양식**이다.
 * 그래서 품명(B열)이 처음부터 비어 있고 Ref(A열)도 "1.2" 같은 공급사 번호가 들어간다.
 *
 *   1행   제목 + Offer number
 *   3행   머리글(Ref / Description / Quantity / Unit cost price / …)
 *   5~9   매입 품목 (전부 자유 입력)
 *   11행  Total:  = SUM(E5:E9)
 *   13~17 프랑코니아 몫 (PM · Engineering · Storage · Packing · CE)
 *   19행  총계 = SUM(E11:E18)  ← Total 시트 59행이 받아 간다
 *   22행  OPTIONS / 24~26 자유 입력
 *   32~40 공급 조건 (Supplier · Valid · Warranty · Lead Time · Incoterms · Terms · Currency · CE · Quality)
 *
 * FACTOR / NEGO 는 Total 시트 59행을 참조한다 (J2=Total!D59, M2=Total!AC59).
 */

import type { TemplateSheet } from "@/engine/types";
import type { Workbook } from "@/engine/workbook";

export const PP_SHEET = "Purchased Parts";
/** Total 시트에서 이 시트를 받는 행 — "Purchase Parts (Dyno,…)" */
export const PP_TOTAL_ROW = 59;
/** Total 시트 "E-Drive parts" — 엑셀에 전용 시트가 없어 앱에서 따로 입력받는다 */
export const EDRIVE_TOTAL_ROW = 60;

export const PP_COL = {
  ref: "A",
  desc: "B",
  qty: "C",
  unitCost: "D",
  totalCost: "E",
  sales: "F",
  offer: "G",
} as const;

export interface PpCondition {
  row: number;
  label: string;
  /** 값을 넣을 칸 (C열) */
  coord: string;
}

export interface PpForm {
  titleRow: number;
  /** 제목 자체도 프로젝트마다 달라 자유 입력이다 */
  titleCoord: string;
  offerCoord: string;
  headRow: number;
  /** 매입 품목 행 */
  items: number[];
  /** Total: 행 */
  subTotalRow: number | null;
  /** 프랑코니아 몫 행 */
  services: number[];
  /** 총계 행 (Total 시트가 받아 가는 값) */
  grandTotalRow: number | null;
  optionRow: number | null;
  options: number[];
  conditions: PpCondition[];
}

export function buildPurchasedParts(tpl: TemplateSheet): PpForm | null {
  const cell = (col: string, row: number) => tpl.cells[`${col}${row}`];
  const lit = (col: string, row: number) => {
    const c = cell(col, row);
    return c && c.f === undefined && typeof c.v === "string" ? c.v.trim() : "";
  };
  const isMoney = (row: number) => new RegExp(`^\\s*C${row}\\s*\\*\\s*D${row}\\s*$`, "i").test(cell(PP_COL.totalCost, row)?.f ?? "");
  const isSum = (row: number) => /^\s*SUM\(/i.test(cell(PP_COL.totalCost, row)?.f ?? "");

  const form: PpForm = {
    titleRow: 1,
    titleCoord: "A1",
    offerCoord: "E1",
    headRow: 3,
    items: [],
    subTotalRow: null,
    services: [],
    grandTotalRow: null,
    optionRow: null,
    options: [],
    conditions: [],
  };

  let inOptions = false;
  let afterGrandTotal = false;

  for (let row = 1; row <= tpl.maxRow; row++) {
    const a = lit(PP_COL.ref, row);
    const b = lit(PP_COL.desc, row);

    if (row === 1 && a) {
      form.titleRow = 1;
      continue;
    }
    if (a === "Ref") {
      form.headRow = row;
      continue;
    }
    if (b === "OPTIONS") {
      form.optionRow = row;
      inOptions = true;
      continue;
    }
    if (isSum(row)) {
      if (form.subTotalRow === null) form.subTotalRow = row;
      else if (form.grandTotalRow === null) {
        form.grandTotalRow = row;
        afterGrandTotal = true;
      }
      continue;
    }
    if (isMoney(row)) {
      if (inOptions) form.options.push(row);
      else if (form.subTotalRow === null) form.items.push(row);
      else form.services.push(row);
      continue;
    }
    // 총계 아래의 라벨 행 = 공급 조건
    if (afterGrandTotal && b) form.conditions.push({ row, label: b.replace(/:$/, ""), coord: `${PP_COL.qty}${row}` });
  }

  return form.items.length ? form : null;
}

// ---------- 엑셀 `Purchased Parts` 시트 → 앱 관리 방식으로 옮기기 ----------
// 59행은 이제 자유 입력 화면이 값을 책임진다. 예전(또는 엑셀에서 가져온) 프로젝트에
// 이 시트 값이 남아 있으면 한 번에 옮겨 올 수 있게 읽어 준다.

export interface SheetQuoteRow {
  ref: string;
  desc: string;
  qty: number;
  unit: number;
}
export interface SheetQuote {
  title: string;
  offer: string;
  items: SheetQuoteRow[];
  services: SheetQuoteRow[];
  options: SheetQuoteRow[];
  conditions: { label: string; value: string }[];
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * 예전 방식으로 값을 담고 있던 시트.
 * 57행 Test System · 59행 Purchase Parts (Dyno,…) 는 이제 자유 입력 화면이 값을 책임진다.
 */
export const LEGACY_SHEET: Record<number, string> = {
  57: "Test System",
  59: PP_SHEET,
};

export function readSheetQuote(wb: Workbook, sheet: string): SheetQuote | null {
  const tpl = wb.template.sheets[sheet];
  if (!tpl) return null;
  const f = buildPurchasedParts(tpl);
  if (!f) return null;
  const row = (r: number): SheetQuoteRow => ({
    ref: str(wb.get(sheet, `${PP_COL.ref}${r}`)),
    desc: str(wb.get(sheet, `${PP_COL.desc}${r}`)),
    qty: num(wb.get(sheet, `${PP_COL.qty}${r}`)),
    unit: num(wb.get(sheet, `${PP_COL.unitCost}${r}`)),
  });
  return {
    title: str(wb.get(sheet, f.titleCoord)),
    offer: str(wb.get(sheet, f.offerCoord)),
    items: f.items.map(row),
    services: f.services.map(row),
    options: f.options.map(row),
    conditions: f.conditions.map((c) => ({ label: c.label, value: str(wb.get(sheet, c.coord)) })),
  };
}

/** 사용자가 이 시트에 직접 넣은 값이 있는지 (템플릿 기본값은 세지 않는다) */
export function hasSheetOverrides(wb: Workbook, sheet: string): boolean {
  const cells = wb.overrides[sheet];
  return !!cells && Object.keys(cells).length > 0;
}

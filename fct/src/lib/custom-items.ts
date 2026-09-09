/**
 * 외부 견적 입력 — 앱이 직접 관리하는 자유 입력 품목.
 *
 * Purchase Parts (Dyno,…) 와 E-Drive parts 는 Price DB 에 없는 공급사 견적을 그대로
 * 옮겨 적는 항목이다. 엑셀 원본은 `Purchased Parts` 탭 한 장에 품목 5줄만 두었고
 * E-Drive parts 는 받아 갈 시트조차 없어(E60 이 빈 칸 'Purchased Parts'!E20 을 본다)
 * 두 항목 모두 템플릿 행에 기대지 않고 여기서 관리한다.
 *
 * 좌표 형식 (예약 시트 `__items`)
 *   "<Total 행>!<구획><번호>!<필드>"   예) "59!i0!desc"  구획: i 품목 · s 프랑코니아 몫 · o 옵션
 *   "<Total 행>!meta!<키>"             예) "59!meta!supplier"
 */

import type { Overrides, Template, TemplateSheet } from "@/engine/types";
import type { Workbook } from "@/engine/workbook";

export const ITEMS_SHEET = "__items";

export const ITEM_FIELDS = ["ref", "desc", "qty", "unit"] as const;
export type ItemField = (typeof ITEM_FIELDS)[number];

/** 구획 — i 매입 품목 · s 프랑코니아 몫 · o 옵션 */
export const SECTIONS = ["i", "s", "o"] as const;
export type Section = (typeof SECTIONS)[number];

/** 머리글과 공급 조건 — Purchased Parts 시트 32~40행과 같은 항목을 쓴다 */
export const ITEM_META = [
  "title",
  "offer",
  "supplier",
  "valid",
  "warranty",
  "lead",
  "incoterms",
  "terms",
  "currency",
  "ce",
  "quality",
] as const;
export type ItemMeta = (typeof ITEM_META)[number];

/** 공급 조건으로 표시할 항목 (title·offer 는 카드 머리에 따로 놓는다) */
export const CONDITION_META: ItemMeta[] = ["supplier", "valid", "warranty", "lead", "incoterms", "terms", "currency", "ce", "quality"];

export const META_LABEL: Record<ItemMeta, string> = {
  title: "Subject",
  offer: "Offer number",
  supplier: "Supplier",
  valid: "Valid",
  warranty: "Warranty",
  lead: "Lead Time",
  incoterms: "Delivery/Incoterms",
  terms: "Terms and Conditions",
  currency: "Currency",
  ce: "CE",
  quality: "Quality",
};

/** 저장 API 가 받아 줄 좌표인지 (서버·클라이언트가 같이 쓴다) */
export const ITEM_COORD_RE = new RegExp(
  `^\\d{1,7}!([${SECTIONS.join("")}]\\d{1,3}!(${ITEM_FIELDS.join("|")})|meta!(${ITEM_META.join("|")}))$`,
);

/** 한 구획에 넣을 수 있는 최대 줄 수 */
export const MAX_ROWS = 60;
/** 비어 있어도 보여 주는 기본 줄 수 */
export const MIN_ROWS = 3;

export function itemCoord(row: number, sec: Section, i: number, f: ItemField): string {
  return `${row}!${sec}${i}!${f}`;
}
export function metaCoord(row: number, k: ItemMeta): string {
  return `${row}!meta!${k}`;
}

/** 프랑코니아 몫처럼 품명이 정해져 있는 줄 */
export interface RowPreset {
  desc: string;
  qty: number;
  unit: number;
}

/**
 * 구획별 기본값.
 * 59행(Dyno)의 프랑코니아 몫 금액은 엑셀 `Purchased Parts` 시트 13~17행 값 그대로다.
 * 60행(E-Drive)은 엑셀에 정해진 금액이 없어 0 에서 시작한다.
 */
export const SERVICE_PRESETS: Record<number, RowPreset[]> = {
  57: [
    { desc: "Installation", qty: 0, unit: 0 },
    { desc: "Shipping", qty: 0, unit: 0 },
  ],
  59: [
    { desc: "Project Management by Frankonia", qty: 1, unit: 15000 },
    { desc: "Engineering Support", qty: 1, unit: 5000 },
    { desc: "Local Storage and Material Handling Support", qty: 1, unit: 15000 },
    { desc: "Packing disposal etc.", qty: 1, unit: 2500 },
    { desc: "CE, Conformity, Documentation Support", qty: 0, unit: 0 },
  ],
  60: [
    { desc: "Project Management by Frankonia", qty: 0, unit: 0 },
    { desc: "Engineering Support", qty: 0, unit: 0 },
    { desc: "Local Storage and Material Handling Support", qty: 0, unit: 0 },
    { desc: "Packing disposal etc.", qty: 0, unit: 0 },
    { desc: "CE, Conformity, Documentation Support", qty: 0, unit: 0 },
  ],
};

export function servicePresets(row: number): RowPreset[] {
  return SERVICE_PRESETS[row] ?? [];
}

/** 공급 조건 기본값 — 엑셀 시트에 이미 적혀 있던 값 */
export const META_PRESETS: Record<number, Partial<Record<ItemMeta, string>>> = {
  57: { supplier: "Frankonia EMC Test Solutions GmbH" },
};

export interface QuoteRow {
  sec: Section;
  i: number;
  ref: string;
  desc: string;
  qty: number;
  unit: number;
  /** 품명이 정해져 있는 줄 (프랑코니아 몫) */
  preset?: RowPreset;
}

const asNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const asStr = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/** 이 구획에서 쓰인 줄 번호 중 가장 큰 값 + 1 */
export function usedRows(overrides: Overrides, row: number, sec: Section): number {
  const cells = overrides[ITEMS_SHEET];
  if (!cells) return 0;
  const head = `${row}!${sec}`;
  let max = -1;
  for (const k of Object.keys(cells)) {
    if (!k.startsWith(head)) continue;
    const i = Number(k.slice(head.length).split("!")[0]);
    if (Number.isInteger(i) && i > max) max = i;
  }
  return max + 1;
}

/** 화면에 보여 줄 줄 수 — 자유 구획은 최소 3줄, 프랑코니아 몫은 정해진 줄 수 */
export function rowCount(overrides: Overrides, row: number, sec: Section): number {
  if (sec === "s") return servicePresets(row).length;
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, usedRows(overrides, row, sec)));
}

export function readRows(wb: Workbook, row: number, sec: Section): QuoteRow[] {
  const presets = sec === "s" ? servicePresets(row) : [];
  const n = rowCount(wb.overrides, row, sec);
  const out: QuoteRow[] = [];
  for (let i = 0; i < n; i++) {
    const g = (f: ItemField) => wb.get(ITEMS_SHEET, itemCoord(row, sec, i, f));
    out.push({
      sec,
      i,
      ref: asStr(g("ref")),
      desc: asStr(g("desc")),
      qty: asNum(g("qty")),
      unit: asNum(g("unit")),
      preset: presets[i],
    });
  }
  return out;
}

export function isEmptyRow(r: QuoteRow): boolean {
  return !r.ref.trim() && !r.desc.trim() && !r.qty && !r.unit;
}

export const rowCost = (r: QuoteRow) => r.qty * r.unit;
export const sumCost = (rows: QuoteRow[]) => rows.reduce((n, r) => n + rowCost(r), 0);

/** 판매가 — 엑셀 시트와 같은 식: 원가 × FACTOR ÷ (1 − NEGO) */
export function salesOf(cost: number, factor: number, nego: number): number {
  return nego < 1 ? (cost * factor) / (1 - nego) : 0;
}
/** 제시 금액 — ROUND(판매가, -1) */
export const offerOf = (sales: number) => Math.round(sales / 10) * 10;

/** 견적에 들어가는 원가 = 매입 품목 + 프랑코니아 몫 (옵션은 별도 견적이라 뺀다) */
export function quoteCost(wb: Workbook, row: number): number {
  return sumCost(readRows(wb, row, "i")) + sumCost(readRows(wb, row, "s"));
}

/**
 * 자유 입력 합계를 Total!E{row} 에 넣어 준다.
 * 원본 수식이 빈 칸을 가리키거나(60행) 이제 이 화면이 값을 책임지는 행(59행)에만 쓴다.
 * 0 이면 override 를 지워 템플릿 값으로 되돌린다.
 * @returns 값이 바뀌었으면 true
 */
export function syncCustomTotal(wb: Workbook, row: number): boolean {
  const cost = quoteCost(wb, row);
  const coord = `E${row}`;
  const now = wb.overrides["Total"]?.[coord];
  const next = cost > 0 ? cost : undefined;
  if (now === next) return false;
  wb.setOverride("Total", coord, next);
  return true;
}

/** 이 행이 앱 관리 방식으로 값을 책임지는지 */
export const CUSTOM_QUOTE_ROWS = [57, 59, 60];

/**
 * 프랑코니아 몫의 기본값을 예약 시트의 "템플릿 리터럴"로 만들어 준다.
 * 이렇게 해야 입력칸에 기본값이 보이고, ↺ 로 되돌릴 수도 있다.
 */
export function itemsTemplateSheet(): TemplateSheet {
  const cells: TemplateSheet["cells"] = {};
  for (const [row, presets] of Object.entries(SERVICE_PRESETS)) {
    presets.forEach((p, i) => {
      cells[itemCoord(Number(row), "s", i, "desc")] = { v: p.desc };
      cells[itemCoord(Number(row), "s", i, "qty")] = { v: p.qty };
      cells[itemCoord(Number(row), "s", i, "unit")] = { v: p.unit, fmt: "eur" };
    });
  }
  for (const [row, meta] of Object.entries(META_PRESETS)) {
    for (const [k, v] of Object.entries(meta)) cells[metaCoord(Number(row), k as ItemMeta)] = { v };
  }
  return { title: ITEMS_SHEET, maxRow: 0, cells };
}

/** 템플릿에 예약 시트를 한 번만 붙인다 */
export function ensureItemsSheet(template: Template): void {
  if (!template.sheets[ITEMS_SHEET]) template.sheets[ITEMS_SHEET] = itemsTemplateSheet();
}

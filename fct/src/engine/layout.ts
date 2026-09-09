/**
 * 챔버/룸/옵션 계산 시트의 행 구조 분석 → 화면 렌더링용 레이아웃
 *
 * 엑셀 시트는 모두 "Ref | Description | Notes | Y/N | Unit | Quantity | Unit cost | Total cost | Sales ..." 헤더 행을
 * 가지므로, 헤더 행을 찾아 열 역할을 결정하고 그 아래 행들을 line / section / subtotal / note 로 분류한다.
 */
import { parseCoord, coordOf, numToCol } from "./parser";
import { TemplateSheet, TemplateCell } from "./types";

export interface ColRoles {
  ref?: number;
  desc?: number;
  notes?: number;
  yn?: number;
  unit?: number;
  qty?: number;
  unitCost?: number;
  cost?: number;
  sales?: number;
  included?: number;
  offer?: number;
  block?: number;
  sage?: number;
}

export type RowKind = "title" | "head" | "header" | "section" | "line" | "subtotal" | "total" | "note";

export interface LayoutRow {
  row: number;
  kind: RowKind;
  /** 행에 존재하는 셀 (열 번호 → 셀) — 최대 열 제한 */
  cells: Record<number, TemplateCell>;
}

export interface SheetLayout {
  sheet: string;
  title: string;
  headerRow: number;
  roles: ColRoles;
  rows: LayoutRow[];
  /** 블록 가격(L열) 라벨 행 → SUM 행 */
  blocks: { label: string; row: number; sumCoord: string }[];
  /** 총계 행 (Total material cost / Total tool cost) */
  totals: { label: string; row: number }[];
  /** 본문 최대 열 (이후는 보조 테이블) */
  bodyMaxCol: number;
  /** 시트 내 수식이 참조하는 셀 좌표 집합 (문자열 리터럴이 입력값인지 판단용) */
  referenced: Set<string>;
}

function text(c?: TemplateCell): string {
  return c && typeof c.v === "string" ? c.v : "";
}

export function buildLayout(sheetName: string, sheet: TemplateSheet): SheetLayout {
  // 행별 셀 수집
  const byRow = new Map<number, Record<number, TemplateCell>>();
  let maxCol = 0;
  for (const [coord, cell] of Object.entries(sheet.cells)) {
    const { col, row } = parseCoord(coord);
    let r = byRow.get(row);
    if (!r) byRow.set(row, (r = {}));
    r[col] = cell;
    if (col > maxCol) maxCol = col;
  }
  const rowsSorted = [...byRow.keys()].sort((a, b) => a - b);
  const referenced = new Set<string>();
  for (const cell of Object.values(sheet.cells)) {
    if (!cell.f) continue;
    for (const m of cell.f.matchAll(/(?<![A-Za-z!'])\$?([A-Z]{1,3})\$?(\d+)(?![\d(])/g)) referenced.add(m[1] + m[2]);
  }

  // 헤더 행 찾기
  let headerRow = 0;
  const roles: ColRoles = {};
  for (const r of rowsSorted) {
    const cells = byRow.get(r)!;
    const texts = Object.entries(cells).map(([c, cell]) => [Number(c), text(cell).toLowerCase().replace(/\s+/g, " ").trim()] as const);
    const hasQty = texts.some(([, t]) => t === "quantity" || t === "qty");
    const isCostHdr = (t: string) => t.startsWith("total material cost") || t.startsWith("total cost price") || t === "material cost price";
    const hasCost = texts.some(([, t]) => isCostHdr(t));
    if (hasQty && hasCost) {
      headerRow = r;
      for (const [c, t] of texts) {
        if (t.startsWith("ref")) roles.ref = c;
        else if (t === "description") roles.desc = c;
        else if (t === "notes" || t === "further details") roles.notes = c;
        else if (t.startsWith("y/n")) roles.yn = c;
        else if (t === "unit") roles.unit = c;
        else if (t === "quantity" || t === "qty") roles.qty = c;
        else if (t.startsWith("unit cost")) roles.unitCost = c;
        else if (isCostHdr(t)) roles.cost = c;
        else if (t.startsWith("material sales price") || t === "sales price") roles.sales = c;
        else if (t.startsWith("material included")) roles.included = c;
        else if (t === "offer value") roles.offer = c;
        else if (t.startsWith("block prices")) roles.block = c;
        else if (t.startsWith("sage")) roles.sage = c;
      }
      if (roles.desc === undefined && roles.ref === 1) {
        roles.desc = 2;
        if (roles.notes === undefined && roles.yn === 4) roles.notes = 3;
      }
      break;
    }
  }
  const bodyMaxCol = roles.block ?? roles.included ?? roles.offer ?? roles.sales ?? maxCol;

  const rows: LayoutRow[] = [];
  const blocks: SheetLayout["blocks"] = [];
  const totals: SheetLayout["totals"] = [];
  let pendingBlockLabel: { label: string; row: number } | null = null;

  for (const r of rowsSorted) {
    const cells = byRow.get(r)!;
    let kind: RowKind;
    if (headerRow === 0 || r < headerRow) kind = r === 1 ? "title" : "head";
    else if (r === headerRow) kind = "header";
    else {
      const costCell = roles.cost ? cells[roles.cost] : undefined;
      const descCell = roles.desc ? cells[roles.desc] : undefined;
      const notesCell = roles.notes ? cells[roles.notes] : undefined;
      const qtyCell = roles.qty ? cells[roles.qty] : undefined;
      const label = (text(descCell) + " " + text(notesCell)).toLowerCase();
      const unitCostCell = roles.unitCost ? cells[roles.unitCost] : undefined;
      const refCell = roles.ref ? cells[roles.ref] : undefined;
      const qtyNumeric = !!qtyCell && (qtyCell.f !== undefined || typeof qtyCell.v === "number");
      const hasCostVal = !!costCell && (costCell.f !== undefined || typeof costCell.v === "number");
      const hasCost = hasCostVal && (!!refCell || qtyNumeric || !!unitCostCell);
      if (hasCostVal && /^\s*(sub)?total\b/.test(label.trim()) && !cells[roles.ref ?? -1]) {
        kind = /total material cost|total tool cost|total:?$|^total/.test(label.trim()) && !label.includes("subtotal") ? "total" : "subtotal";
        if (kind === "total") totals.push({ label: text(descCell) || text(notesCell), row: r });
      } else if (hasCostVal && !cells[roles.ref ?? -1] && !descCell && costCell?.f && /SUM\(/i.test(costCell.f)) {
        kind = "subtotal"; // 라벨 없는 합계 행 (예: RVC S H201)
      } else if (hasCost) kind = "line";
      else if (descCell || notesCell || (qtyCell && qtyCell.f)) {
        // 섹션 헤더 (설명 텍스트 + 수량 SUM 또는 텍스트만)
        kind = descCell && typeof descCell.v === "string" && descCell.v.trim() ? "section" : "note";
      } else kind = "note";
    }
    // 블록 가격 (L열): 라벨 행 다음에 SUM 행
    if (roles.block) {
      const b = cells[roles.block];
      if (b) {
        if (typeof b.v === "string" && b.v.trim() && kind !== "header") pendingBlockLabel = { label: b.v.trim(), row: r };
        else if (b.f && /^SUM\(/i.test(b.f) && pendingBlockLabel) {
          blocks.push({ ...pendingBlockLabel, sumCoord: coordOf(roles.block, r) });
          pendingBlockLabel = null;
        }
      }
    }
    rows.push({ row: r, kind, cells });
  }

  return {
    sheet: sheetName,
    title: text(sheet.cells["B1"]) || sheetName,
    headerRow,
    roles,
    rows,
    blocks,
    totals,
    bodyMaxCol,
    referenced,
  };
}

export { numToCol, coordOf };

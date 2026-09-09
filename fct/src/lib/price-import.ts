/**
 * 가격 DB 엑셀 업로드.
 *
 * 계산표 엑셀의 `Prices resume` 시트를 읽어 현재 가격 DB 와 견준다.
 * 열 배치는 추출 스크립트(tools/extract_template.py)와 같다.
 *   A Ref · B Sage no. · C Item · D Description · E Unit · F Price/unit
 *   G Delivery · H~K 보조 · L Price date
 * A 열이 비어 있는 줄은 머리글/구분선이고, 그중 "12 - Doors" 처럼 번호가 붙은 줄이 카테고리다.
 */

import ExcelJS from "exceljs";
import type { PriceRow, Scalar } from "@/engine/types";
import type { PriceItem } from "@/lib/data";

export const PRICES_SHEET = "Prices resume";

export interface PriceDiffRow {
  row: number;
  ref: string;
  item: string;
  /** 바뀐 내용 요약 */
  before: string;
  after: string;
}

export interface PriceImportResult {
  fileName: string;
  /** 파일에 적힌 견적 버전 (Total 시트 O1, 없으면 파일 이름에서 찾는다) */
  version: string | null;
  rows: PriceRow[];
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
  /** 화면에 보여 줄 변경 예시 */
  samples: PriceDiffRow[];
  warnings: string[];
}

const CAT_RE = /^\s*(\d+)\s*-\s*(.+?)\s*$/;
const REV_RE = /rev[-_ ]?x?\s*([0-9]+(?:\.[0-9]+)*)/i;

/** 셀 값을 숫자/문자/null 로 정리 — 수식 셀은 계산된 값을 쓴다 */
function val(cell: ExcelJS.Cell): Scalar {
  let v: unknown = cell.value;
  if (v && typeof v === "object") {
    if ("result" in (v as object)) v = (v as { result: unknown }).result;
    else if ("text" in (v as object)) v = (v as { text: unknown }).text;
    else if ("richText" in (v as object)) v = (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    else if (v instanceof Date) v = v.toISOString().slice(0, 10);
    else v = null;
  }
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return String(v);
  const s = String(v).trim();
  return s === "" ? null : s;
}

const str = (v: Scalar | undefined): string => (v === null || v === undefined ? "" : String(v));
const num = (v: Scalar | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** 두 값이 사실상 같은가 (숫자는 소수점 6자리까지) */
function same(a: Scalar | undefined, b: Scalar | undefined): boolean {
  if (a === b) return true;
  const na = num(a),
    nb = num(b);
  if (na !== null && nb !== null) return Math.abs(na - nb) < 1e-6;
  return str(a).trim() === str(b).trim();
}

/** 업로드한 파일을 읽어 현재 가격 DB 와 견준다 (저장은 하지 않는다) */
export async function readPriceWorkbook(buffer: ArrayBuffer, fileName: string, current: PriceItem[]): Promise<PriceImportResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new Error("EXCEL_OPEN_FAILED");
  }
  const ws = wb.getWorksheet(PRICES_SHEET);
  if (!ws) throw new Error("NO_PRICES_SHEET");

  const warnings: string[] = [];

  // 견적 버전 — Total 시트 O1 에 적혀 있고, 없으면 파일 이름에서 찾는다
  let version: string | null = null;
  const totalWs = wb.getWorksheet("Total");
  if (totalWs) {
    const o1 = val(totalWs.getCell("O1"));
    if (typeof o1 === "string" && o1.trim()) version = o1.trim();
  }
  if (!version) {
    const m = REV_RE.exec(fileName);
    if (m) version = `rev-x${m[1]}`;
  }

  const rows: PriceRow[] = [];
  let category: string | null = null;
  const maxRow = Math.min(ws.rowCount, 20000);
  for (let r = 1; r <= maxRow; r++) {
    const cells: Scalar[] = [];
    let empty = true;
    for (let c = 1; c <= 12; c++) {
      const v = val(ws.getCell(r, c));
      if (v !== null) empty = false;
      cells.push(v);
    }
    if (empty) continue;
    const [a, b, cItem, d, e, f, g, h, i, j, k, l] = cells;
    if (a === null && typeof cItem === "string") {
      const m = CAT_RE.exec(cItem);
      if (m) category = m[2];
    }
    rows.push({
      row: r,
      ref: (a as number | string | null) ?? null,
      sage: str(b) || null,
      item: str(cItem) || null,
      description: str(d) || null,
      unit: str(e) || null,
      price: num(f),
      delivery: g,
      colH: h,
      colI: i,
      colJ: j,
      colK: k,
      priceDate: str(l) || null,
      category: a !== null ? category : null,
      isHeader: a === null,
    });
  }

  if (!rows.length) throw new Error("EMPTY_PRICES_SHEET");

  // ---------- 현재 DB 와 비교 ----------
  const cur = new Map<number, PriceItem>();
  for (const p of current) cur.set(p.row, p);
  const seen = new Set<number>();
  let added = 0,
    changed = 0,
    unchanged = 0;
  const samples: PriceDiffRow[] = [];

  // 실제로 반영할 때(applyPriceImport)와 같은 기준으로 센다 — 머리글 줄은 세지 않는다
  for (const nr of rows) {
    seen.add(nr.row);
    if (nr.isHeader && nr.ref === null) continue;
    const old = cur.get(nr.row);
    if (!old) {
      added++;
      if (samples.length < 40)
        samples.push({ row: nr.row, ref: str(nr.ref), item: str(nr.item), before: "—", after: nr.price === null ? "—" : String(nr.price) });
      continue;
    }
    const priceSame = same(nr.price, old.price);
    const textSame = same(nr.item, old.item) && same(nr.description, old.description) && same(nr.unit, old.unit);
    if (priceSame && textSame) {
      unchanged++;
      continue;
    }
    changed++;
    if (samples.length < 40)
      samples.push({
        row: nr.row,
        ref: str(nr.ref),
        item: str(nr.item) || str(old.item),
        before: priceSame ? "…" : old.price === null ? "—" : String(old.price),
        after: priceSame ? "…" : nr.price === null ? "—" : String(nr.price),
      });
  }
  const removed = current.filter((p) => !seen.has(p.row)).length;

  if (removed > current.length / 2) warnings.push("MANY_REMOVED");

  return { fileName, version, rows, added, changed, removed, unchanged, samples, warnings };
}

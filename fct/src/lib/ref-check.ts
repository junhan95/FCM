/**
 * 제품 번호(Ref) 점검.
 *
 * 챔버 시트의 품명·단가는 `VLOOKUP(A10, Prices, …)` 로 가격 DB 에서 가져온다.
 * A열에 가격 DB 에 없는 값(예: 엑셀에서 손으로 적은 "Spare")이 들어가면 그 줄이 #N/A 가 되고,
 * 시트 합계 → Total 시트 → 최종가까지 통째로 #N/A 가 된다.
 * 엑셀과 똑같은 동작이지만 화면만 봐서는 원인을 알 수 없어, 여기서 원인 칸을 찾아 준다.
 */

import type { Scalar } from "@/engine/types";
import type { Workbook } from "@/engine/workbook";

export interface BadRef {
  sheet: string;
  row: number;
  /** Ref 가 들어 있는 칸 (A10 …) */
  coord: string;
  value: Scalar;
  /** 같은 줄의 수량 — 실제로 쓰이는 줄인지 판단하는 데 쓴다 */
  qty: number | null;
  /** 수량 칸 좌표 (있으면) */
  qtyCoord: string | null;
}

const VLOOKUP_RE = /VLOOKUP\(\s*\$?([A-Z]{1,3})\$?(\d+)\s*,\s*Prices\b/i;

/**
 * 견적에 쓰이는 시트 목록 — Total 시트가 원가를 가져오는 시트만 본다.
 * (템플릿에는 어느 행도 참조하지 않는 시트가 남아 있어, 그쪽 오류까지 알릴 필요는 없다)
 */
export function quotedSheets(wb: Workbook): string[] {
  const total = wb.template.sheets["Total"];
  if (!total) return Object.keys(wb.template.sheets);
  const out = new Set<string>();
  for (let r = 9; r <= 60; r++) {
    const f = total.cells[`E${r}`]?.f;
    if (!f) continue;
    const m = /^'([^']+)'!|^([A-Za-z][A-Za-z0-9\- ]*?)!/.exec(f);
    const name = m ? (m[1] ?? m[2]) : null;
    if (name && wb.template.sheets[name]) out.add(name);
  }
  return [...out];
}

/**
 * 가격 DB 에서 찾을 수 없는 Ref 를 모두 찾아 준다.
 * 수량이 0 이어도 알린다 — 엑셀에서 0 × #N/A 는 여전히 #N/A 라 합계가 통째로 깨진다.
 * @param sheets 검사할 시트 (없으면 견적에 쓰이는 시트 전부)
 */
export function findBadRefs(wb: Workbook, sheets?: string[]): BadRef[] {
  const out: BadRef[] = [];
  const names = sheets ?? quotedSheets(wb);
  for (const name of names) {
    const sheet = wb.template.sheets[name];
    if (!sheet) continue;
    const seen = new Set<string>();
    for (const [, cell] of Object.entries(sheet.cells)) {
      const m = VLOOKUP_RE.exec(cell.f ?? "");
      if (!m) continue;
      const coord = `${m[1]}${m[2]}`;
      if (seen.has(coord)) continue;
      seen.add(coord);
      const ref = wb.inputValue(name, coord);
      // 빈 칸과 0(예비 줄 표시)은 정상이다
      if (ref === null || ref === undefined || ref === "" || ref === 0) continue;
      if (wb.hasPriceRef(ref)) continue;
      const row = Number(m[2]);
      // 같은 줄에서 수량 칸을 찾는다 — 리터럴 숫자이면서 원가 수식이 참조하는 열
      let qtyCoord: string | null = null;
      for (const col of ["C", "F", "E", "D"]) {
        const c = sheet.cells[`${col}${row}`];
        if (c && c.f === undefined && typeof c.v === "number") {
          qtyCoord = `${col}${row}`;
          break;
        }
      }
      const qtyVal = qtyCoord ? wb.get(name, qtyCoord) : null;
      out.push({
        sheet: name,
        row,
        coord,
        value: ref,
        qty: typeof qtyVal === "number" ? qtyVal : null,
        qtyCoord,
      });
    }
  }
  out.sort((a, b) => a.sheet.localeCompare(b.sheet) || a.row - b.row);
  return out;
}

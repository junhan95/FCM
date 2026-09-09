/**
 * 구성품 직접 추가 — 템플릿의 "예비 행"을 쓴다.
 *
 * 계산 시트에는 A열이 리터럴 0 이고 B열이 `VLOOKUP(A…,Prices,3,FALSE)` 인 행이
 * 섹션마다 몇 개씩 들어 있다. 견적 담당자가 목록에 없는 품목을 끼워 넣으라고
 * 템플릿 작성자가 비워 둔 자리다. A열에 가격 DB 의 Ref 를 넣으면 품명·단가·
 * 소계 수식이 모두 살아나고, 섹션 합계 SUM 범위 안에 이미 들어 있으므로
 * 금액도 자동으로 맞는다. (엑셀 파일 불러오기도 같은 자리를 쓴다 — import-excel.ts)
 */
import type { TemplateSheet } from "@/engine/types";
import { parseCoord } from "@/engine/parser";

/** 템플릿에서 예비 행(빈 자리) 번호 목록 */
export function findSpareRows(tpl: TemplateSheet): number[] {
  const out: number[] = [];
  for (const [coord, cell] of Object.entries(tpl.cells)) {
    if (cell.f !== undefined || cell.v !== 0) continue;
    const { col, row } = parseCoord(coord);
    if (col !== 1) continue;
    const b = tpl.cells[`B${row}`];
    if (!b?.f || !/VLOOKUP/i.test(b.f)) continue;
    out.push(row);
  }
  return out.sort((a, b) => a - b);
}

export interface SpareSlot {
  row: number;
  /** 요청한 섹션 안에 자리가 있었는지 */
  inSection: boolean;
}

/**
 * 쓸 수 있는 예비 행을 고른다.
 *   1순위 요청한 섹션 안 · 2순위 같은 카테고리 카드 안 · 3순위 시트에서 가장 가까운 행
 * 템플릿은 섹션의 3분의 1 정도에만 예비 행을 두었으므로 밖으로 나가는 일이 흔하다.
 * 어디에 들어가는지는 고르기 전에 사용자에게 보여 준다 (AddPartDialog).
 */
export function pickSpareRow(
  spare: number[],
  used: (row: number) => boolean,
  section: { from: number; to: number },
  category?: { from: number; to: number },
): SpareSlot | null {
  const free = spare.filter((r) => !used(r));
  if (!free.length) return null;
  const inside = free.find((r) => r >= section.from && r <= section.to);
  if (inside !== undefined) return { row: inside, inSection: true };
  if (category) {
    const inCat = free.find((r) => r >= category.from && r <= category.to);
    if (inCat !== undefined) return { row: inCat, inSection: false };
  }
  const ideal = (section.from + section.to) / 2;
  const near = free.reduce((best, r) => (Math.abs(r - ideal) < Math.abs(best - ideal) ? r : best), free[0]);
  return { row: near, inSection: false };
}

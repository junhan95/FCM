/**
 * 직접 추가한 구성품의 "보이는 자리".
 *
 * 템플릿의 예비 행은 섹션의 3분의 1 정도에만 있어서, 예를 들어 Single Leaf Door 에
 * 문을 하나 더 넣으면 계산은 다른 섹션의 빈 행에서 이뤄질 수밖에 없다. 금액은 시트
 * 합계에 그대로 들어가므로 계산은 맞지만, 담당자 눈에는 엉뚱한 목록에 붙어 보인다.
 *
 * 그래서 "이 행은 어느 섹션 목록에 보여야 하는가"를 따로 적어 둔다.
 * overrides 안의 예약 키(`__placement`)에 `"<시트>!<행>": <섹션 머리글 행>` 으로 저장한다 —
 * 실제 시트 이름이 아니므로 엔진의 셀 계산·범위 순회에는 전혀 끼어들지 않고,
 * 프로젝트 저장/불러오기에는 overrides 의 일부로 함께 실린다.
 */
import type { Overrides } from "@/engine/types";

export const PLACEMENT_SHEET = "__placement";

const key = (sheet: string, row: number) => `${sheet}!${row}`;

/** 시트의 행 → 표시할 섹션 머리글 행 */
export function readPlacement(overrides: Overrides, sheet: string): Map<number, number> {
  const out = new Map<number, number>();
  const p = overrides[PLACEMENT_SHEET];
  if (!p) return out;
  const prefix = sheet + "!";
  for (const [k, v] of Object.entries(p)) {
    if (!k.startsWith(prefix) || typeof v !== "number") continue;
    const row = Number(k.slice(prefix.length));
    if (Number.isFinite(row)) out.set(row, v);
  }
  return out;
}

export function placementCoord(sheet: string, row: number): { sheet: string; coord: string } {
  return { sheet: PLACEMENT_SHEET, coord: key(sheet, row) };
}

/**
 * 목록에서 감춘 행.
 *
 * 견적에서 뺀 품목을 담당자가 계속 보고 있을 이유는 없지만, 템플릿 행을 실제로
 * 지울 수는 없다(계산표의 SUM 범위가 그 행을 지나간다). 그래서 수량을 0 으로 만들고
 * "안 보이게 한다"는 표시만 따로 남긴다 — 언제든 다시 꺼낼 수 있다.
 * 저장 방식은 `__placement` 와 같다.
 */
export const HIDDEN_SHEET = "__hidden";

/**
 * 감춘 행 → 감출 때의 수량.
 * 되돌릴 때 그 수량을 그대로 돌려주기 위해 값으로 담아 둔다 (0 도 유효한 값이므로
 * 참/거짓이 아니라 키가 있는지로 판단한다).
 */
export function readHidden(overrides: Overrides, sheet: string): Map<number, number> {
  const out = new Map<number, number>();
  const h = overrides[HIDDEN_SHEET];
  if (!h) return out;
  const prefix = sheet + "!";
  for (const [k, v] of Object.entries(h)) {
    if (!k.startsWith(prefix)) continue;
    const row = Number(k.slice(prefix.length));
    if (Number.isFinite(row)) out.set(row, typeof v === "number" ? v : 0);
  }
  return out;
}

export function hiddenCoord(sheet: string, row: number): { sheet: string; coord: string } {
  return { sheet: HIDDEN_SHEET, coord: key(sheet, row) };
}

/**
 * "Purchased Parts (Fire, Gas)" — 엑셀 원본의 `Fire & Gas` 탭을 그대로 옮기기 위한 메타데이터.
 *
 * 원본 시트 구조 (두 블록이 같은 모양으로 반복된다)
 *   A: Ref   B: Description   C: Quantity   D: Unit cost price
 *   E: Total cost price(=C*D)  F: Material sales price(=E*FACTOR/(1-NEGO))  G: Offer value(=ROUND(F,-1))
 *   H: 비고
 *
 *   1행  블록 제목 + Offer number
 *   3행  머리글(Ref…)
 *   4~8  품목 (4·7행은 버전 구분용 소제목)
 *   10행 Total
 *   13행 OPTIONS 머리글 / 15~17행 자유 입력
 *   22행부터 Gas Detection System 이 같은 모양으로 반복
 *
 * FACTOR / NEGO 는 시트가 직접 갖고 있지 않고 Total 시트 58행을 참조한다 (J2=Total!D58, M2=Total!AC58).
 */

import type { TemplateSheet } from "@/engine/types";
import type { Workbook } from "@/engine/workbook";

export const FG_SHEET = "Fire & Gas";
/** Total 시트에서 이 시트를 받는 행 — "Purchased Parts (Fire, Gas)" */
export const FG_TOTAL_ROW = 58;

/** 열 문자 */
export const FG_COL = {
  ref: "A",
  desc: "B",
  qty: "C",
  unitCost: "D",
  totalCost: "E",
  sales: "F",
  offer: "G",
  note: "H",
} as const;

export type FgLineKind = "group" | "item" | "option";

export interface FgLine {
  row: number;
  kind: FgLineKind;
}

export interface FgBlock {
  /** 블록 제목 (Fire Detection System …) */
  title: string;
  /** 제목이 있는 행 */
  titleRow: number;
  /** Offer number 자유 입력 칸 (템플릿에 없는 좌표 — override 로만 채운다) */
  offerCoord: string;
  /** 머리글 행 */
  headRow: number;
  /** 소제목 + 품목 행 */
  lines: FgLine[];
  /** Total: 행 (없으면 null) */
  totalRow: number | null;
  /** OPTIONS 머리글 행 */
  optionRow: number | null;
  /** OPTIONS 자유 입력 행 */
  options: number[];
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * 템플릿에서 블록 구조를 읽어 낸다.
 * 행 번호를 박아 두지 않고 시트를 훑어 찾으므로 템플릿이 조금 바뀌어도 따라간다.
 */
export function buildFireGas(tpl: TemplateSheet): FgBlock[] {
  const cell = (col: string, row: number) => tpl.cells[`${col}${row}`];
  const str = (col: string, row: number) => {
    const c = cell(col, row);
    return c && c.f === undefined && typeof c.v === "string" ? c.v.trim() : "";
  };
  /** E열이 C*D 인 행 = 금액을 계산하는 품목 행 */
  const isMoneyRow = (row: number) => {
    const f = cell(FG_COL.totalCost, row)?.f ?? "";
    return new RegExp(`^\\s*C${row}\\s*\\*\\s*D${row}\\s*$`, "i").test(f);
  };

  const blocks: FgBlock[] = [];
  let cur: FgBlock | null = null;
  let inOptions = false;

  for (let row = 1; row <= tpl.maxRow; row++) {
    const a = str(FG_COL.ref, row);
    const b = str(FG_COL.desc, row);

    // 블록 제목 — A열에 제목만 있고 머리글/Total 이 아닌 행
    if (a && !cell(FG_COL.qty, row) && a !== "Ref") {
      cur = {
        title: a,
        titleRow: row,
        offerCoord: `E${row}`,
        headRow: row,
        lines: [],
        totalRow: null,
        optionRow: null,
        options: [],
      };
      blocks.push(cur);
      inOptions = false;
      continue;
    }
    if (!cur) continue;

    if (a === "Ref") {
      cur.headRow = row;
      continue;
    }
    if (b === "Total:") {
      cur.totalRow = row;
      continue;
    }
    if (b === "OPTIONS") {
      cur.optionRow = row;
      inOptions = true;
      continue;
    }
    if (isMoneyRow(row)) {
      if (inOptions) {
        cur.options.push(row);
        cur.lines.push({ row, kind: "option" });
      } else {
        cur.lines.push({ row, kind: "item" });
      }
      continue;
    }
    // 금액 계산이 없는데 품명이 있으면 버전 구분용 소제목
    if (!inOptions && (b || cell(FG_COL.desc, row)?.f)) cur.lines.push({ row, kind: "group" });
  }

  return blocks;
}

/** 이 시트가 만들어 내는 원가 합계 — 각 블록의 Total: 행을 더한다 (OPTIONS 는 별도 견적이라 빼놓는다) */
export function fireGasCost(wb: Workbook, blocks: FgBlock[]): number {
  let sum = 0;
  for (const b of blocks) {
    if (b.totalRow) sum += num(wb.get(FG_SHEET, `${FG_COL.totalCost}${b.totalRow}`));
  }
  return sum;
}

/**
 * Total!E58 은 원본 엑셀에서 `'Purchased Parts'!E18` 을 가리키는데 그 칸이 비어 있어
 * Fire & Gas 시트에 무엇을 넣어도 견적 합계에 잡히지 않는다.
 * 이 함수가 계산한 원가를 E58 에 직접 넣어 연결을 잇는다. (0 이면 override 를 지운다)
 * @returns 값이 바뀌었으면 true
 */
export function syncFireGasTotal(wb: Workbook): boolean {
  const tpl = wb.template.sheets[FG_SHEET];
  if (!tpl) return false;
  const cost = fireGasCost(wb, buildFireGas(tpl));
  const coord = `E${FG_TOTAL_ROW}`;
  const now = wb.overrides["Total"]?.[coord];
  const next = cost > 0 ? cost : undefined;
  if (now === next) return false;
  wb.setOverride("Total", coord, next);
  return true;
}

/** Total!E58 이 시트 내용과 어긋나 있는지 (엑셀에서 가져온 프로젝트 확인용) */
export function fireGasOutOfSync(wb: Workbook): boolean {
  const tpl = wb.template.sheets[FG_SHEET];
  if (!tpl) return false;
  const cost = fireGasCost(wb, buildFireGas(tpl));
  return Math.abs(num(wb.get("Total", `E${FG_TOTAL_ROW}`)) - cost) > 0.005;
}

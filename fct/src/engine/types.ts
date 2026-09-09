/**
 * FCT 계산 엔진 — 공통 타입
 *
 * 엑셀 템플릿의 셀을 { v: 값 } 또는 { f: 수식 } 형태로 보관하고,
 * 프로젝트별 입력(overrides)을 덧씌워 계산한다.
 */

export type Scalar = number | string | boolean | null;

export class ExcelError {
  constructor(public readonly code: string) {}
  toString() {
    return this.code;
  }
}

export type CellValue = Scalar | ExcelError;

export interface TemplateCell {
  /** 리터럴 값 */
  v?: Scalar;
  /** 수식 (앞의 '=' 제외) */
  f?: string;
  /** 표시 형식 분류: pct, eur, usd, int, d1, d2, d3, date */
  fmt?: string;
}

export interface TemplateSheet {
  title: string;
  hidden?: boolean;
  maxRow: number;
  cells: Record<string, TemplateCell>;
  merged?: string[];
  validations?: { sqref: string; type: string; formula1: string }[];
}

export interface Template {
  sheets: Record<string, TemplateSheet>;
  order: string[];
  names: Record<string, string>;
}

/** 가격 DB 한 행 (Prices resume 시트의 한 행) */
export interface PriceRow {
  row: number;
  ref: number | string | null;
  sage?: Scalar;
  item?: Scalar;
  description?: Scalar;
  unit?: Scalar;
  price?: Scalar;
  delivery?: Scalar;
  colH?: Scalar;
  colI?: Scalar;
  colJ?: Scalar;
  colK?: Scalar;
  priceDate?: Scalar;
  category?: string | null;
  isHeader?: boolean;
}

/** 프로젝트별 입력값: sheet → coord → value */
export type Overrides = Record<string, Record<string, Scalar>>;

export const PRICES_SHEET = "Prices resume";

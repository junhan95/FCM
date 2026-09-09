/**
 * FCT 계산 엔진 — 워크북 평가기
 *
 * 템플릿(셀 값/수식) + 가격 DB + 프로젝트 입력(overrides)을 합쳐
 * 엑셀과 동일한 의미로 셀 값을 계산한다. (지연 평가 + 메모이제이션)
 */
import { Ast, parseFormula, parseCoord, coordOf, colToNum } from "./parser";
import {
  CellValue,
  ExcelError,
  Overrides,
  PriceRow,
  PRICES_SHEET,
  Scalar,
  Template,
  TemplateCell,
} from "./types";

const ERR = {
  VALUE: new ExcelError("#VALUE!"),
  DIV0: new ExcelError("#DIV/0!"),
  NA: new ExcelError("#N/A"),
  REF: new ExcelError("#REF!"),
  NAME: new ExcelError("#NAME?"),
  CYCLE: new ExcelError("#CYCLE!"),
};

const PRICE_COLS = ["ref", "sage", "item", "description", "unit", "price", "delivery", "colH", "colI", "colJ", "colK", "priceDate"] as const;

export function isErr(v: unknown): v is ExcelError {
  return v instanceof ExcelError;
}

function toNumber(v: CellValue): number | ExcelError {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (isErr(v)) return v;
  const s = v.trim();
  if (s === "") return ERR.VALUE;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : ERR.VALUE;
}

let DECIMAL_SEP = ".";
export function setDecimalSeparator(sep: string) {
  DECIMAL_SEP = sep;
}
function numToText(n: number): string {
  const s = Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(15)));
  return DECIMAL_SEP === "." ? s : s.replace(".", DECIMAL_SEP);
}

function toText(v: CellValue): string | ExcelError {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return numToText(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return v;
}

function toBool(v: CellValue): boolean | ExcelError {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (isErr(v)) return v;
  const u = v.trim().toUpperCase();
  if (u === "TRUE") return true;
  if (u === "FALSE") return false;
  return ERR.VALUE;
}

function typeRank(v: CellValue): number {
  if (typeof v === "number") return 0;
  if (typeof v === "string") return 1;
  if (typeof v === "boolean") return 2;
  return 0;
}

/** 엑셀 비교 (=, <>, <, >, <=, >=) */
function compare(a: CellValue, b: CellValue): number {
  if (a === null || a === undefined) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0;
  if (b === null || b === undefined) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
  const ra = typeRank(a), rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  if (typeof a === "number" && typeof b === "number") return a === b ? 0 : a < b ? -1 : 1;
  if (typeof a === "string" && typeof b === "string") {
    const x = a.toLowerCase(), y = b.toLowerCase();
    return x === y ? 0 : x < y ? -1 : 1;
  }
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
  return 0;
}

function excelRound(x: number, digits: number): number {
  const f = Math.pow(10, digits);
  const y = Math.abs(x) * f;
  // 부동소수점 보정
  const r = Math.round(y + 1e-9);
  return (Math.sign(x) * r) / f;
}

interface RangeRef {
  sheet: string;
  c1: number;
  r1: number;
  c2: number;
  r2: number;
}

export class Workbook {
  private cache = new Map<string, CellValue>();
  private evaluating = new Set<string>();
  private astCache = new Map<string, Ast>();
  private priceCells = new Map<string, Scalar>(); // coord → 값 (Prices resume 시트)
  private priceIndexNum = new Map<number, PriceRow>();
  private priceIndexStr = new Map<string, PriceRow>();
  private priceRowsByRow = new Map<number, PriceRow>();
  private priceMaxRow = 0;
  private nameAst = new Map<string, Ast>();
  /** 시트별 열 → 사용된 행 목록 (범위 순회 최적화) */
  private sheetRows = new Map<string, Map<number, number[]>>();

  constructor(
    public readonly template: Template,
    prices: PriceRow[],
    public overrides: Overrides = {},
  ) {
    this.setPrices(prices);
    for (const [name, text] of Object.entries(template.names)) {
      try {
        this.nameAst.set(name.toUpperCase(), parseFormula(text));
      } catch {
        /* 무시 */
      }
    }
    for (const [sname, sheet] of Object.entries(template.sheets)) {
      const byCol = new Map<number, number[]>();
      for (const coord of Object.keys(sheet.cells)) {
        // A1 형식이 아닌 좌표를 쓰는 시트도 있다 (앱 전용 예약 시트) — 범위 검색 색인에서만 뺀다
        let pos: { col: number; row: number };
        try {
          pos = parseCoord(coord);
        } catch {
          continue;
        }
        const { col, row } = pos;
        let arr = byCol.get(col);
        if (!arr) byCol.set(col, (arr = []));
        arr.push(row);
      }
      for (const arr of byCol.values()) arr.sort((a, b) => a - b);
      this.sheetRows.set(sname, byCol);
    }
  }

  setPrices(prices: PriceRow[]) {
    this.priceCells.clear();
    this.priceIndexNum.clear();
    this.priceIndexStr.clear();
    this.priceRowsByRow.clear();
    this.priceMaxRow = 0;
    for (const p of prices) {
      this.priceRowsByRow.set(p.row, p);
      if (p.row > this.priceMaxRow) this.priceMaxRow = p.row;
      PRICE_COLS.forEach((k, i) => {
        const v = p[k] as Scalar | undefined;
        if (v !== undefined && v !== null) this.priceCells.set(coordOf(i + 1, p.row), v);
      });
      if (p.ref !== null && p.ref !== undefined) {
        if (typeof p.ref === "number") {
          if (!this.priceIndexNum.has(p.ref)) this.priceIndexNum.set(p.ref, p);
        } else {
          const k = String(p.ref).toLowerCase();
          if (!this.priceIndexStr.has(k)) this.priceIndexStr.set(k, p);
        }
      }
    }
    this.invalidate();
  }

  setOverrides(ov: Overrides) {
    this.overrides = ov;
    this.invalidate();
  }

  setOverride(sheet: string, coord: string, value: Scalar | undefined) {
    const s = (this.overrides[sheet] ??= {});
    if (value === undefined) delete s[coord];
    else s[coord] = value;
    if (Object.keys(s).length === 0) delete this.overrides[sheet];
    this.invalidate();
  }

  /** 이 Ref 가 가격 DB 에 있는지 (화면에서 잘못된 제품 번호를 찾아낼 때 쓴다) */
  hasPriceRef(ref: Scalar | undefined): boolean {
    if (ref === null || ref === undefined || ref === "") return false;
    if (typeof ref === "number") return this.priceIndexNum.has(ref);
    return this.priceIndexStr.has(String(ref).toLowerCase());
  }

  invalidate() {
    this.cache.clear();
    this.evaluating.clear();
  }

  hasSheet(name: string) {
    return name === PRICES_SHEET || !!this.template.sheets[name];
  }

  templateCell(sheet: string, coord: string): TemplateCell | undefined {
    return this.template.sheets[sheet]?.cells[coord];
  }

  /** 셀의 현재 입력값 (override 우선) — 수식 셀이면 undefined */
  inputValue(sheet: string, coord: string): Scalar | undefined {
    const ov = this.overrides[sheet]?.[coord];
    if (ov !== undefined) return ov;
    const c = this.templateCell(sheet, coord);
    if (c && c.f === undefined) return c.v ?? null;
    return undefined;
  }

  isOverridden(sheet: string, coord: string) {
    return this.overrides[sheet]?.[coord] !== undefined;
  }

  /** 셀 값 계산 */
  get(sheet: string, coord: string): CellValue {
    if (sheet === PRICES_SHEET) return this.priceCells.get(coord) ?? null;
    const key = sheet + "!" + coord;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const ov = this.overrides[sheet]?.[coord];
    if (ov !== undefined) {
      this.cache.set(key, ov);
      return ov;
    }
    const cell = this.template.sheets[sheet]?.cells[coord];
    if (!cell) return null;
    if (cell.f === undefined) return cell.v ?? null;
    if (this.evaluating.has(key)) return ERR.CYCLE;
    this.evaluating.add(key);
    let ast = this.astCache.get(key);
    if (!ast) {
      try {
        ast = parseFormula(cell.f);
      } catch {
        this.evaluating.delete(key);
        this.cache.set(key, ERR.NAME);
        return ERR.NAME;
      }
      this.astCache.set(key, ast);
    }
    let v: CellValue;
    try {
      v = this.evalAst(ast, sheet);
    } catch {
      v = ERR.VALUE;
    }
    // 엑셀: 수식 결과가 빈 셀 참조이면 0
    if (v === null || v === undefined) v = 0;
    this.evaluating.delete(key);
    this.cache.set(key, v);
    return v;
  }

  /** 시트 전체 계산 결과 */
  evalSheet(sheet: string): Record<string, CellValue> {
    const out: Record<string, CellValue> = {};
    const s = this.template.sheets[sheet];
    if (!s) return out;
    for (const coord of Object.keys(s.cells)) out[coord] = this.get(sheet, coord);
    for (const coord of Object.keys(this.overrides[sheet] ?? {})) out[coord] = this.get(sheet, coord);
    return out;
  }

  // ---------- 범위 처리 ----------
  private resolveRange(a: Ast, ctxSheet: string): RangeRef | ExcelError {
    if (a.t === "range") return { sheet: a.sheet ?? ctxSheet, c1: a.c1, r1: a.r1, c2: a.c2, r2: a.r2 };
    if (a.t === "ref") return { sheet: a.sheet ?? ctxSheet, c1: a.col, r1: a.row, c2: a.col, r2: a.row };
    if (a.t === "name") {
      const n = this.nameAst.get(a.v.toUpperCase());
      if (!n) return ERR.NAME;
      return this.resolveRange(n, ctxSheet);
    }
    if (a.t === "err") return new ExcelError(a.v);
    return ERR.VALUE;
  }

  /** 범위 내 값들을 순회 (빈 셀은 건너뜀) */
  private *iterRange(r: RangeRef): Generator<CellValue> {
    if (r.sheet === PRICES_SHEET) {
      const r2 = Math.min(r.r2, this.priceMaxRow);
      for (let row = r.r1; row <= r2; row++) {
        const p = this.priceRowsByRow.get(row);
        if (!p) continue;
        for (let c = r.c1; c <= Math.min(r.c2, 12); c++) {
          const v = p[PRICE_COLS[c - 1]] as Scalar | undefined;
          if (v !== undefined && v !== null) yield v;
        }
      }
      return;
    }
    const byCol = this.sheetRows.get(r.sheet);
    const ovs = this.overrides[r.sheet];
    if (!byCol) {
      return;
    }
    for (let c = r.c1; c <= r.c2; c++) {
      const rows = byCol.get(c);
      const seen = new Set<number>();
      if (rows) {
        for (const row of rows) {
          if (row < r.r1) continue;
          if (row > r.r2) break;
          seen.add(row);
          yield this.get(r.sheet, coordOf(c, row));
        }
      }
      if (ovs) {
        for (const coord of Object.keys(ovs)) {
          const pc = parseCoord(coord);
          if (pc.col === c && pc.row >= r.r1 && pc.row <= r.r2 && !seen.has(pc.row)) yield ovs[coord];
        }
      }
    }
  }

  private vlookup(lookup: CellValue, r: RangeRef, colIdx: number): CellValue {
    if (isErr(lookup)) return lookup;
    if (lookup === null || lookup === undefined) lookup = 0; // 빈 셀 → 0
    if (colIdx < 1) return ERR.VALUE;
    if (r.sheet === PRICES_SHEET && r.r1 <= 1 && r.r2 >= this.priceMaxRow && r.c1 === 1) {
      let hit: PriceRow | undefined;
      if (typeof lookup === "number") hit = this.priceIndexNum.get(lookup);
      else if (typeof lookup === "string") hit = this.priceIndexStr.get(lookup.toLowerCase());
      else if (lookup === null) hit = undefined;
      if (!hit) return ERR.NA;
      const key = PRICE_COLS[colIdx - 1];
      if (!key) return ERR.REF;
      const v = hit[key] as Scalar | undefined;
      return v === undefined ? null : v;
    }
    const r2 = r.sheet === PRICES_SHEET ? Math.min(r.r2, this.priceMaxRow) : Math.min(r.r2, this.template.sheets[r.sheet]?.maxRow ?? 0);
    const lk = lookup === null ? null : lookup;
    for (let row = r.r1; row <= r2; row++) {
      const v = this.get(r.sheet, coordOf(r.c1, row));
      if (v === null || v === undefined) continue;
      if (lk === null) continue;
      if (typeof lk === "number" && typeof v === "number" && lk === v) return this.get(r.sheet, coordOf(r.c1 + colIdx - 1, row));
      if (typeof lk === "string" && typeof v === "string" && lk.toLowerCase() === v.toLowerCase())
        return this.get(r.sheet, coordOf(r.c1 + colIdx - 1, row));
      if (typeof lk === "boolean" && typeof v === "boolean" && lk === v) return this.get(r.sheet, coordOf(r.c1 + colIdx - 1, row));
    }
    return ERR.NA;
  }

  // ---------- AST 평가 ----------
  private evalAst(a: Ast, sheet: string): CellValue {
    switch (a.t) {
      case "num":
        return a.v;
      case "str":
        return a.v;
      case "bool":
        return a.v;
      case "err":
        return new ExcelError(a.v);
      case "empty":
        return null;
      case "ref": {
        const s = a.sheet ?? sheet;
        if (!this.hasSheet(s)) return ERR.REF;
        return this.get(s, coordOf(a.col, a.row));
      }
      case "range":
        return ERR.VALUE; // 단독 범위는 값으로 못 씀
      case "name": {
        const n = this.nameAst.get(a.v.toUpperCase());
        if (!n) return ERR.NAME;
        return this.evalAst(n, sheet);
      }
      case "un": {
        const v = toNumber(this.evalAst(a.a, sheet));
        return isErr(v) ? v : -v;
      }
      case "bin":
        return this.evalBin(a, sheet);
      case "call":
        return this.evalCall(a.fn, a.args, sheet);
    }
  }

  private evalBin(a: Extract<Ast, { t: "bin" }>, sheet: string): CellValue {
    const lv = this.evalAst(a.a, sheet);
    const rv = this.evalAst(a.b, sheet);
    if (isErr(lv)) return lv;
    if (isErr(rv)) return rv;
    switch (a.op) {
      case "&": {
        const x = toText(lv), y = toText(rv);
        if (isErr(x)) return x;
        if (isErr(y)) return y;
        return x + y;
      }
      case "=":
        return compare(lv, rv) === 0;
      case "<>":
        return compare(lv, rv) !== 0;
      case "<":
        return compare(lv, rv) < 0;
      case ">":
        return compare(lv, rv) > 0;
      case "<=":
        return compare(lv, rv) <= 0;
      case ">=":
        return compare(lv, rv) >= 0;
    }
    const x = toNumber(lv), y = toNumber(rv);
    if (isErr(x)) return x;
    if (isErr(y)) return y;
    switch (a.op) {
      case "+":
        return x + y;
      case "-":
        return x - y;
      case "*":
        return x * y;
      case "/":
        return y === 0 ? ERR.DIV0 : x / y;
      case "^":
        return Math.pow(x, y);
    }
    return ERR.VALUE;
  }

  private evalCall(fn: string, args: Ast[], sheet: string): CellValue {
    switch (fn) {
      case "IF": {
        const c = toBool(this.evalAst(args[0], sheet));
        if (isErr(c)) return c;
        if (c) return args[1] ? this.evalAst(args[1], sheet) : true;
        return args[2] ? this.evalAst(args[2], sheet) : false;
      }
      case "SUM": {
        let s = 0;
        for (const arg of args) {
          if (arg.t === "range" || arg.t === "name") {
            const r = this.resolveRange(arg, sheet);
            if (isErr(r)) return r;
            for (const v of this.iterRange(r)) {
              if (typeof v === "number") s += v;
              else if (isErr(v)) return v;
            }
          } else {
            const v = toNumber(this.evalAst(arg, sheet));
            if (isErr(v)) return v;
            s += v;
          }
        }
        return s;
      }
      case "VLOOKUP": {
        const lookup = this.evalAst(args[0], sheet);
        const r = this.resolveRange(args[1], sheet);
        if (isErr(r)) return r;
        const ci = toNumber(this.evalAst(args[2], sheet));
        if (isErr(ci)) return ci;
        return this.vlookup(lookup, r, Math.floor(ci));
      }
      case "ROUND": {
        const x = toNumber(this.evalAst(args[0], sheet));
        const d = toNumber(args[1] ? this.evalAst(args[1], sheet) : 0);
        if (isErr(x)) return x;
        if (isErr(d)) return d;
        return excelRound(x, Math.trunc(d));
      }
      case "INT": {
        const x = toNumber(this.evalAst(args[0], sheet));
        return isErr(x) ? x : Math.floor(x);
      }
      case "AND": {
        let res = true;
        for (const arg of args) {
          if (arg.t === "range") {
            const r = this.resolveRange(arg, sheet);
            if (isErr(r)) return r;
            for (const v of this.iterRange(r)) {
              if (typeof v === "number") res = res && v !== 0;
              else if (typeof v === "boolean") res = res && v;
              else if (isErr(v)) return v;
            }
          } else {
            const b = toBool(this.evalAst(arg, sheet));
            if (isErr(b)) return b;
            res = res && b;
          }
        }
        return res;
      }
      case "OR": {
        let res = false;
        for (const arg of args) {
          const b = toBool(this.evalAst(arg, sheet));
          if (isErr(b)) return b;
          res = res || b;
        }
        return res;
      }
      case "MAX":
      case "MIN": {
        const vals: number[] = [];
        for (const arg of args) {
          if (arg.t === "range") {
            const r = this.resolveRange(arg, sheet);
            if (isErr(r)) return r;
            for (const v of this.iterRange(r)) if (typeof v === "number") vals.push(v);
          } else {
            const v = toNumber(this.evalAst(arg, sheet));
            if (isErr(v)) return v;
            vals.push(v);
          }
        }
        if (!vals.length) return 0;
        return fn === "MAX" ? Math.max(...vals) : Math.min(...vals);
      }
      case "ROUNDUP":
      case "ROUNDDOWN": {
        const x = toNumber(this.evalAst(args[0], sheet));
        const d = toNumber(args[1] ? this.evalAst(args[1], sheet) : 0);
        if (isErr(x)) return x;
        if (isErr(d)) return d;
        const f = Math.pow(10, Math.trunc(d));
        const y = Math.abs(x) * f;
        const r = fn === "ROUNDUP" ? Math.ceil(y - 1e-9) : Math.floor(y + 1e-9);
        return (Math.sign(x) * r) / f;
      }
      case "ABS": {
        const x = toNumber(this.evalAst(args[0], sheet));
        return isErr(x) ? x : Math.abs(x);
      }
      case "IFERROR": {
        const v = this.evalAst(args[0], sheet);
        return isErr(v) ? this.evalAst(args[1], sheet) : v;
      }
      case "ISERROR":
        return isErr(this.evalAst(args[0], sheet));
      case "NOT": {
        const b = toBool(this.evalAst(args[0], sheet));
        return isErr(b) ? b : !b;
      }
      default:
        return ERR.NAME;
    }
  }
}

/** 표시용 숫자 변환 (오류/문자열은 그대로) */
export function asNumber(v: CellValue): number | null {
  return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : null;
}

export { colToNum };

import { CellValue, ExcelError } from "@/engine/types";

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const nfg = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

/** 셀 값을 표시 문자열로 (엑셀 표시 형식 분류 기준) */
export function fmtValue(v: CellValue | undefined, fmt?: string): string {
  if (v === null || v === undefined) return "";
  if (v instanceof ExcelError) return v.code;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v;
  switch (fmt) {
    case "pct":
      return nf2.format(v * 100) + " %";
    case "eur":
      return "€ " + nf0.format(v);
    case "eur2":
      return "€ " + nf2.format(v);
    case "usd":
      return "$ " + nf0.format(v);
    case "int":
      return nf0.format(v);
    case "d1":
      return v.toFixed(1);
    case "d2":
      return nf2.format(v);
    case "d3":
      return nf3.format(v);
    default:
      return nfg.format(v);
  }
}

export function fmtEur(v: CellValue | undefined) {
  return typeof v === "number" ? "€ " + nf0.format(v) : fmtValue(v);
}
export function fmtUsd(v: CellValue | undefined) {
  return typeof v === "number" ? "$ " + nf0.format(v) : fmtValue(v);
}
export function fmtNum(v: CellValue | undefined, digits = 2) {
  if (typeof v !== "number") return fmtValue(v);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(v);
}

/** 입력 문자열 → 저장값 (숫자면 number, 아니면 string) */
export function parseInput(s: string): number | string {
  const t = s.trim();
  if (t === "") return "";
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^-?\d+(,\d+)?$/.test(t)) return Number(t.replace(",", "."));
  if (/^-?\d+(\.\d+)?\s*%$/.test(t)) return Number(t.replace("%", "")) / 100;
  return t;
}

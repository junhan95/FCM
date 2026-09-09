/**
 * OPTIONS — 엑셀 원본 `Total` 탭 74~179행.
 *
 * 본 견적(Subtotal 1+2)에는 들어가지 않고 따로 제시하는 선택 항목이다.
 * (74~179행을 참조하는 셀이 시트 어디에도 없다 — 최종가에 더해지지 않는다)
 *
 *   1.1  Final Test by ARC Seibersdorf                75~113
 *   1.2  Final Test by SIS Chamber                   115~124
 *   2    A2 Absorber option                          127~158
 *   3    Translation of Documentation …              161~166
 *   4    Optional Accessories                        169~179
 */

import type { TemplateSheet } from "@/engine/types";

export const T = "Total";

/** 표시 형식 — 입력 가능 여부는 템플릿이 수식인지로 판단한다 */
export type OptColKind = "text" | "num" | "int" | "eur" | "usd" | "pct" | "d2" | "yn";

export interface OptCol {
  /** 엑셀 열 문자 */
  col: string;
  /** 열 제목 */
  label: string;
  kind: OptColKind;
  width: string;
  align?: "left" | "right" | "center";
  /** 값을 고칠 수 없는 안내 열 */
  readOnly?: boolean;
  /** 긴 글이 잘리지 않게 줄바꿈 */
  wrap?: boolean;
  /** 안내 문구처럼 흐리게 */
  muted?: boolean;
  /** 수량처럼 ▲▼ 로 조절 */
  step?: boolean;
}

export interface OptSetting {
  label: string;
  coord: string;
  kind: OptColKind;
  /** 이름 있는 목록에서 고른다 */
  list?: string;
  /** 고정 목록 */
  options?: string[];
  /** 목록 값을 숫자로 저장한다 (엑셀 수식이 숫자로 비교한다) */
  numeric?: boolean;
  /** 값이 비었거나 자리표시자면 알려 준다 */
  required?: boolean;
}

export interface OptExtra {
  /** 화면에 쓸 이름 — 시트 값이 아니라 양식의 일부라 여기에 적어 둔다 */
  label: string;
  /** 고르는 칸 */
  pick: string;
  list: string;
  /** 결과 금액 */
  value: string;
}

export interface OptSection {
  id: string;
  /** 엑셀에 적힌 번호 (1.1, 2 …) */
  no: string;
  title: string;
  subtitle?: string;
  settings: OptSetting[];
  cols: OptCol[];
  /** 품목 행 범위 — 이 안에서 실제 계산 행만 골라 쓴다 */
  from: number;
  to: number;
  /** 계산 행인지 판단할 기준 열 (이 열에 수식이 있으면 품목 행) */
  markerCol: string;
  /** 챔버 선택에 따라 걸러 볼 수 있는지 */
  filterable?: boolean;
  /** 엑셀에서 머리글 글자가 섞여 들어간 줄 — 숫자 열의 리터럴 문자열은 비워서 보여 준다 */
  captionRows?: number[];
  /** 소계 · 합계 줄 */
  subtotal?: { row: number; label: string; coord: string };
  extras?: OptExtra[];
  total?: { label: string; coords: { coord: string; kind: OptColKind }[]; order?: string; adj?: string };
  /** 합계만 있는 줄 (Optional Accessories) */
  sum?: { row: number; label: string; coord: string; adj?: string };
  /** 견적 요약에서 줄을 읽어 낼 때 쓰는 열 역할 */
  rowRoles?: { desc: string; qty: string; sales: string; order?: string; adj?: string };
}

const SE_TEST = ["18", "40"];
const SIS_LOCATION = ["USA", "Europe", "Asia & South America", "Mexico, Canada, Brazil"];

export const OPTION_SECTIONS: OptSection[] = [
  {
    id: "arc",
    no: "1.1",
    title: "Final Test by ARC Seibersdorf",
    settings: [
      { label: "Factor", coord: "C78", kind: "d2" },
      { label: "Type of SE test (GHz)", coord: "D78", kind: "num", options: SE_TEST, numeric: true },
      { label: "Frankonia Supervisor", coord: "E78", kind: "text", list: "Supervisor", required: true },
    ],
    cols: [
      { col: "B", label: "Description", kind: "text", width: "auto", align: "left", readOnly: true, wrap: true },
      { col: "C", label: "Qty", kind: "num", width: "92px", step: true },
      { col: "D", label: "Configuration", kind: "text", width: "190px", align: "left" },
      { col: "E", label: "Days", kind: "int", width: "88px", step: true },
      { col: "F", label: "SV cost", kind: "eur", width: "104px" },
      { col: "H", label: "Test cost", kind: "eur", width: "104px" },
      { col: "I", label: "Total cost", kind: "eur", width: "108px" },
      { col: "K", label: "Sales price", kind: "eur", width: "112px" },
      { col: "L", label: "Note", kind: "text", width: "240px", align: "left", readOnly: true, wrap: true, muted: true },
    ],
    from: 79,
    to: 109,
    markerCol: "I",
    filterable: true,
    captionRows: [79],
    rowRoles: { desc: "B", qty: "C", sales: "K" },
    subtotal: { row: 110, label: "Subtotal", coord: "K110" },
    extras: [
      { label: "Travel, transportation & report by Seibersdorf", pick: "G111", list: "Transport", value: "K111" },
      { label: "Travel costs for Frankonia engineer / supervisor", pick: "G112", list: "Travel_cost", value: "K112" },
    ],
    total: { label: "Total sales", coords: [{ coord: "K113", kind: "eur" }], order: "L113", adj: "N113" },
  },
  {
    id: "sis",
    no: "1.2",
    title: "Final Test by SIS Chamber",
    settings: [
      { label: "Factor", coord: "C117", kind: "d2" },
      { label: "Type of SE test", coord: "D117", kind: "text" },
      { label: "Location", coord: "F117", kind: "text", options: SIS_LOCATION },
      { label: "USD rate SV", coord: "H117", kind: "d2" },
      { label: "Frankonia SV", coord: "I117", kind: "text", list: "Supervisor", required: true },
    ],
    cols: [
      { col: "D", label: "Configuration", kind: "text", width: "auto", align: "left" },
      { col: "C", label: "Qty", kind: "num", width: "92px", step: true },
      { col: "F", label: "Total cost", kind: "usd", width: "120px" },
      { col: "H", label: "SV days", kind: "int", width: "92px", step: true },
      { col: "I", label: "Total cost SV", kind: "usd", width: "124px" },
      { col: "K", label: "Sales price $", kind: "usd", width: "124px" },
      { col: "L", label: "Sales price €", kind: "eur", width: "124px" },
    ],
    from: 119,
    to: 123,
    markerCol: "K",
    rowRoles: { desc: "D", qty: "C", sales: "L" },
    total: {
      label: "Total sales",
      coords: [
        { coord: "K124", kind: "usd" },
        { coord: "L124", kind: "eur" },
      ],
      order: "M124",
      adj: "O124",
    },
  },
  {
    id: "a2",
    no: "2",
    title: "A2 Absorber option",
    settings: [
      { label: "Factor for A2 Absorber", coord: "C129", kind: "d2" },
      { label: "Commission / Negotiation", coord: "C130", kind: "pct" },
    ],
    cols: [
      { col: "B", label: "Description", kind: "text", width: "auto", align: "left", readOnly: true, wrap: true },
      { col: "C", label: "Qty", kind: "num", width: "92px", step: true },
      { col: "D", label: "Cost price", kind: "eur", width: "112px" },
      { col: "E", label: "Total cost", kind: "eur", width: "112px" },
      { col: "F", label: "Sales price", kind: "eur", width: "116px" },
      { col: "H", label: "USD incl. tax", kind: "usd", width: "124px" },
      { col: "I", label: "Order", kind: "yn", width: "72px" },
      { col: "K", label: "Adj. sales price", kind: "eur", width: "124px" },
    ],
    from: 133,
    to: 158,
    markerCol: "E",
    filterable: true,
    rowRoles: { desc: "B", qty: "C", sales: "F", order: "I", adj: "K" },
  },
  {
    id: "translation",
    no: "3",
    title: "Translation of Documentation into National languae",
    settings: [],
    cols: [
      { col: "B", label: "Description", kind: "text", width: "auto", align: "left", readOnly: true, wrap: true },
      { col: "C", label: "Qty", kind: "num", width: "92px", step: true },
      { col: "D", label: "Cost price", kind: "eur", width: "112px" },
      { col: "E", label: "Total cost", kind: "eur", width: "112px" },
      { col: "F", label: "Sales price", kind: "eur", width: "116px" },
      { col: "H", label: "USD incl. tax", kind: "usd", width: "124px" },
      { col: "I", label: "Order", kind: "yn", width: "72px" },
      { col: "K", label: "Adj. sales price", kind: "eur", width: "124px" },
    ],
    from: 164,
    to: 166,
    markerCol: "E",
    rowRoles: { desc: "B", qty: "C", sales: "F", order: "I", adj: "K" },
  },
  {
    id: "accessories",
    no: "4",
    title: "Optional Accessories",
    settings: [
      { label: "Factor Options", coord: "C171", kind: "d2" },
      { label: "Commission / Negotiation", coord: "C172", kind: "pct" },
    ],
    cols: [
      { col: "A", label: "Ref", kind: "num", width: "104px" },
      { col: "B", label: "Description", kind: "text", width: "auto", align: "left", readOnly: true, wrap: true },
      { col: "C", label: "Qty", kind: "num", width: "92px", step: true },
      { col: "D", label: "Cost price", kind: "eur", width: "112px" },
      { col: "E", label: "Total cost", kind: "eur", width: "112px" },
      { col: "F", label: "Sales price", kind: "eur", width: "116px" },
      { col: "H", label: "USD incl. tax", kind: "usd", width: "124px" },
      { col: "I", label: "Order", kind: "yn", width: "72px" },
      { col: "K", label: "Adj. sales price", kind: "eur", width: "124px" },
    ],
    from: 175,
    to: 178,
    markerCol: "E",
    sum: { row: 179, label: "Sum", coord: "F179", adj: "K179" },
    rowRoles: { desc: "B", qty: "C", sales: "F", order: "I", adj: "K" },
  },
];

/** 이 섹션에서 실제로 값을 계산하는 행 번호 */
export function optionRows(tpl: TemplateSheet, s: OptSection): number[] {
  const out: number[] = [];
  for (let r = s.from; r <= s.to; r++) {
    if (tpl.cells[`${s.markerCol}${r}`]?.f) out.push(r);
  }
  return out;
}

/**
 * 이 줄이 어느 챔버(Total 행)에 딸린 줄인지.
 * 품명이 `AH9` / `B45` 처럼 챔버 행을 가리키면 그 행 번호를 돌려준다.
 * `>> FAC mode` 처럼 딸림 줄이면 바로 위 줄의 챔버를 물려받는다.
 */
export function chamberRowOf(tpl: TemplateSheet, rows: number[]): Map<number, number> {
  const map = new Map<number, number>();
  let last: number | undefined;
  for (const r of rows) {
    const f = tpl.cells[`B${r}`]?.f ?? "";
    const m = /(?:AH|B)\$?(\d+)/.exec(f);
    if (m) {
      const n = Number(m[1]);
      if (n >= 9 && n <= 60) {
        last = n;
        map.set(r, n);
        continue;
      }
    }
    if (last !== undefined) map.set(r, last);
  }
  return map;
}

// ---------- 견적 요약에 붙일 옵션 내역 ----------
// 옵션은 본 견적(Subtotal 1+2)에 더해지지 않는다. 별도 항목으로만 보여 준다.

import type { Workbook } from "@/engine/workbook";

export interface OptionPick {
  row: number;
  label: string;
  qty: number;
  /** 제시 금액 (€) — 조정 금액이 있으면 그 값 */
  amount: number;
  ordered: boolean;
  adjusted: boolean;
}

export interface OptionSummary {
  id: string;
  no: string;
  title: string;
  picks: OptionPick[];
  /** 이 항목의 제시 금액 합 (€) */
  total: number;
  /** 참고용 달러 금액 (1.2 SIS) */
  usd?: number;
  /** 항목 전체 주문 여부 (1.1 · 1.2) */
  ordered?: boolean;
  /** 합계를 손으로 조정했는지 */
  adjusted: boolean;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const isY = (v: unknown) => typeof v === "string" && v.trim().toUpperCase() === "Y";

export function collectOptions(wb: Workbook): OptionSummary[] {
  const tpl = wb.template.sheets[T];
  if (!tpl) return [];
  const g = (c: string) => wb.get(T, c);
  const out: OptionSummary[] = [];

  for (const s of OPTION_SECTIONS) {
    const roles = s.rowRoles;
    if (!roles) continue;
    const picks: OptionPick[] = [];
    for (const r of optionRows(tpl, s)) {
      const qty = n(g(`${roles.qty}${r}`));
      const sales = n(g(`${roles.sales}${r}`));
      const adj = roles.adj ? n(g(`${roles.adj}${r}`)) : 0;
      const ordered = roles.order ? isY(g(`${roles.order}${r}`)) : false;
      if (qty <= 0 && adj <= 0 && !ordered) continue;
      picks.push({
        row: r,
        label: String(g(`${roles.desc}${r}`) ?? "").trim() || `#${r}`,
        qty,
        amount: adj > 0 ? adj : sales,
        ordered,
        adjusted: adj > 0,
      });
    }

    // 항목 단위 합계 — 1.1 / 1.2 는 시트에 합계 줄이 있고, 4번은 Sum 줄이 있다
    let total = picks.reduce((a, p) => a + p.amount, 0);
    let adjusted = picks.some((p) => p.adjusted);
    let usd: number | undefined;
    let ordered: boolean | undefined;

    if (s.total) {
      const eur = s.total.coords.find((c) => c.kind === "eur")?.coord;
      const usdCoord = s.total.coords.find((c) => c.kind === "usd")?.coord;
      const adj = s.total.adj ? n(g(s.total.adj)) : 0;
      total = adj > 0 ? adj : eur ? n(g(eur)) : total;
      adjusted = adj > 0;
      if (usdCoord) usd = n(g(usdCoord));
      ordered = s.total.order ? isY(g(s.total.order)) : undefined;
    } else if (s.sum) {
      const adj = s.sum.adj ? n(g(s.sum.adj)) : 0;
      if (adj > 0) {
        total = adj;
        adjusted = true;
      } else {
        total = n(g(s.sum.coord)) || total;
      }
    }

    if (!picks.length && total <= 0) continue;
    out.push({ id: s.id, no: s.no, title: s.title, picks, total, usd, ordered, adjusted });
  }

  return out;
}

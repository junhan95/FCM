/**
 * 엑셀 Total 시트의 "Quotation & Calculation Conditions" 블록 (T74:AH113).
 *
 * 라벨은 시트에 들어 있는 문구를 그대로 읽어 쓴다 — 견적서에 나가는 문장이므로
 * 번역하거나 다시 타이핑하지 않는다. 여기서는 "어느 셀이 무엇이고 어떻게 입력받는가"만 정의한다.
 *
 * 값 셀은 모두 리터럴이라 그대로 덮어쓸 수 있고, 선택지가 정해진 칸(설치 범위·포함 여부·
 * 통화 등)은 템플릿에 "included/ not included" 처럼 슬래시로 적혀 있던 후보를 드롭다운으로 만든다.
 */

export type CondKind = "text" | "select" | "pct";

export interface CondField {
  /** 값이 들어 있는 셀 */
  value: string;
  kind: CondKind;
  /** 라벨이 들어 있는 셀 (없으면 라벨 없음) */
  label?: string;
  /** 라벨을 값 오른쪽에 두는 형태 (지급 조건·납기·보증) */
  labelRight?: string;
  /** 오른쪽 끝 보조 설명 셀 */
  note?: string;
  options?: string[];
  /** 같은 줄 오른쪽에 붙는 부가 입력 (Via REP 의 수수료율) */
  extra?: { value: string; kind: CondKind };
}

export interface CondGroup {
  /** 소제목이 들어 있는 셀 (없으면 소제목 없음) */
  title?: string;
  rows: CondField[];
}

const INCL = ["included", "not included"];

export const CONDITION_GROUPS: CondGroup[] = [
  {
    rows: [
      { label: "T75", value: "U75", kind: "text" },
      { label: "T76", value: "U76", kind: "text" },
      { label: "T77", value: "U77", kind: "text", extra: { value: "Y77", kind: "pct" } },
      {
        value: "U78",
        kind: "select",
        options: ["net - no commission included", "commission included"],
      },
    ],
  },
  {
    title: "T79",
    rows: [
      { label: "T80", value: "U80", kind: "pct", labelRight: "V80" },
      { value: "U81", kind: "pct", labelRight: "V81" },
      { value: "U82", kind: "pct", labelRight: "V82", note: "X82" },
      { value: "U83", kind: "pct", labelRight: "V83", note: "X83" },
      { value: "U84", kind: "pct", labelRight: "V84", note: "X84" },
      { value: "U85", kind: "pct", labelRight: "V85", note: "X85" },
      { value: "U86", kind: "pct", labelRight: "V86" },
      { value: "U87", kind: "text", labelRight: "V87" },
    ],
  },
  {
    title: "T88",
    rows: [
      { label: "T89", value: "U89", kind: "text", labelRight: "V89" },
      { value: "U90", kind: "text", labelRight: "V90" },
      { value: "U91", kind: "text", labelRight: "V91" },
      { value: "U92", kind: "text", labelRight: "V92" },
      { value: "U93", kind: "text", labelRight: "V93" },
      { value: "U94", kind: "text", labelRight: "V94" },
    ],
  },
  {
    title: "T95",
    rows: [
      { label: "T96", value: "U96", kind: "text", labelRight: "V96" },
      { value: "U97", kind: "text", labelRight: "V97" },
      { value: "U98", kind: "text", labelRight: "V98" },
    ],
  },
  {
    title: "T99",
    rows: [
      {
        label: "T100",
        value: "U100",
        kind: "select",
        options: ["Full Installation", "SV only + local manpower", "no installation"],
      },
      { label: "T101", value: "U101", kind: "select", options: ["Standard", "local adapted"], note: "W101" },
      { label: "T102", value: "U102", kind: "select", options: INCL },
      { label: "T103", value: "U103", kind: "select", options: INCL, note: "W103" },
      { label: "T104", value: "U104", kind: "select", options: INCL },
      { label: "T105", value: "U105", kind: "select", options: ["EUR", "USD", "RMB", "INR"] },
      { label: "T106", value: "U106", kind: "select", options: INCL },
      { label: "T107", value: "U107", kind: "select", options: INCL },
      { label: "T108", value: "U108", kind: "select", options: ["included", "optional"] },
      { label: "T109", value: "U109", kind: "select", options: ["Poland only", "China only", "both"] },
    ],
  },
  {
    title: "T110",
    // 인코텀즈 뒤에 항구·도시가 붙는다 (CIF Vietnam) — 목록으로 고정하면 목적지를 잃는다
    rows: [{ label: "T111", value: "U111", kind: "text" }],
  },
  {
    title: "T112",
    rows: [{ label: "T113", value: "U113", kind: "text" }],
  },
];

/** 인코텀즈 입력 도움말 */
export const INCOTERMS = ["EXW", "FCA", "CIF", "CIP", "DAP", "DDP"];

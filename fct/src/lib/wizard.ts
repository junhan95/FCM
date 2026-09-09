/**
 * 견적 위저드용 메타데이터 — Total 시트의 행을 "메인 챔버 / 부속실 / 추가 항목"으로 분류하고,
 * 챔버 시트의 섹션을 사용자 친화적인 그룹으로 묶는다.
 */

export type ChamberGroup = "compact" | "fac" | "sac" | "sac10" | "vehicle" | "special";

export const CHAMBER_GROUP_LABEL: Record<ChamberGroup, { ko: string; en: string }> = {
  compact: { ko: "소형 · 부품 시험", en: "Compact / component" },
  fac: { ko: "전무향실 (FAR)", en: "Fully anechoic" },
  sac: { ko: "반무향실 3m · 5m", en: "Semi anechoic 3m / 5m" },
  sac10: { ko: "반무향실 10m · MIL", en: "Semi anechoic 10m / MIL" },
  vehicle: { ko: "차량 · E-Drive", en: "Vehicle / E-Drive" },
  special: { ko: "특수 (안테나 · 잔향실)", en: "Special (antenna / reverberation)" },
};

/** Total 시트 행 번호 기준 분류 */
export const MAIN_CHAMBER_ROWS = Array.from({ length: 40 }, (_, i) => 9 + i); // 9..48
export const ROOM_ROWS = [49, 50, 51, 52]; // CR, AR, CR/AR-Combi, SR
// 54행 Verification 은 엑셀 원본에 계산식(E54)이 아예 없어 늘 0 이라 화면에서 뺀다.
// (값이 남아 있는 프로젝트는 "상세 보기(엑셀형)" 에서 확인할 수 있다)
export const EXTRA_ROWS = [53, 57, 58, 59, 60]; // Monitoring, Test System, Purchased parts…

/**
 * Total 행 → 실제로 편집해야 할 시트.
 * 원본 엑셀의 E열 참조가 엉뚱한 곳(빈 칸)을 가리키는 행만 여기서 바로잡는다.
 * 58행 "Purchased Parts (Fire, Gas)" 는 E58 이 'Purchased Parts'!E18(빈 칸)을 보지만,
 * Fire & Gas 시트가 J2=Total!D58 · M2=Total!AC58 로 이 행을 참조하므로 짝은 Fire & Gas 다.
 */
export const ROW_SHEET_FIX: Record<number, string> = { 58: "Fire & Gas" };

/**
 * 3단계에서 전용 화면으로 그리는 Total 행.
 * `sheet` 가 null 이면 엑셀에 대응하는 시트가 없어 앱에서 자유 입력으로 받는다.
 */
export const SPECIAL_PART_ROWS: Record<number, { id: string; sheet: string | null }> = {
  53: { id: "Monitoring", sheet: "Monitoring" },
  57: { id: "row57", sheet: null },
  58: { id: "Fire & Gas", sheet: "Fire & Gas" },
  59: { id: "row59", sheet: null },
  60: { id: "row60", sheet: null },
};

export function chamberGroup(name: string, row: number): ChamberGroup {
  const n = name.toUpperCase();
  if (/AVTC|VEHICLE|EDTC|SAC-10V/.test(n)) return "vehicle";
  if (/ANTENNA|REVERBERATION|RVC/.test(n)) return "special";
  if (/SAC-10|MIL-STD/.test(n)) return "sac10";
  if (/^SAC-|TRANSFORMER/.test(n)) return "sac";
  if (/^FAC-/.test(n)) return "fac";
  if (row >= 9 && row <= 48) return "compact";
  return "compact";
}

/** 챔버 시트 섹션 → 구성품 카테고리 */
export type PartCategory =
  | "structure"
  | "absorber"
  | "door"
  | "electrical"
  | "filter"
  | "hvac"
  | "automation"
  | "safety"
  | "av"
  | "misc";

export const PART_CATEGORY_LABEL: Record<PartCategory, { ko: string; en: string; icon: string }> = {
  structure: { ko: "차폐 · 구조 · 바닥", en: "Shielding, structure & floor", icon: "▦" },
  absorber: { ko: "흡수체 (페라이트 · 폼)", en: "Absorbers (ferrite / foam)", icon: "◤" },
  door: { ko: "출입문 · 게이트", en: "Doors & gates", icon: "▯" },
  electrical: { ko: "전기 설비 · EUT 전원", en: "Electrical & EUT power", icon: "⚡" },
  filter: { ko: "필터 · 관통패널", en: "Filters & penetration panels", icon: "⊞" },
  hvac: { ko: "환기 (허니컴 · 팬)", en: "Ventilation (honeycomb / fan)", icon: "≋" },
  automation: { ko: "자동화 · 시험 테이블", en: "Automation & test table", icon: "⟳" },
  safety: { ko: "화재 · 가스 감지", en: "Fire & gas detection", icon: "△" },
  av: { ko: "광컨버터 · 카메라", en: "Optical converters & cameras", icon: "◉" },
  misc: { ko: "기타 · 공구 · 운반", en: "Other, tools & handling", icon: "⋯" },
};

export const PART_CATEGORY_ORDER: PartCategory[] = [
  "structure",
  "absorber",
  "door",
  "electrical",
  "filter",
  "hvac",
  "automation",
  "safety",
  "av",
  "misc",
];

export function partCategory(sectionName: string): PartCategory {
  const s = sectionName.toLowerCase();
  if (/absorb|ferrite|frankosorb|pyramid|hybrid/.test(s)) return "absorber";
  if (/door|gate|ramp|platform|leaf/.test(s)) return "door";
  if (/honeycomb|fan|ventilat/.test(s)) return "hvac";
  if (/fire|gas|water detection/.test(s)) return "safety";
  if (/automation|turntable|test table|antenna mast|test axis/.test(s)) return "automation";
  if (/converter|camera|monitoring|optic|pontis|display|audio|video/.test(s)) return "av";
  if (/filter|penetration|rfi|connection panel|socket|cp\d|\bcp\b/.test(s)) return "filter";
  if (/electric|inspection|dguv|eut/.test(s)) return "electrical";
  if (/shielding|structure|floor|ground plane|raised|finishing|membrane|isolation/.test(s)) return "structure";
  if (/tool|handling|packaging|unloading|container|misc|other|antenna package|special equipment/.test(s)) return "misc";
  return "misc";
}

/** 위저드 단계 정의 */
export const STEPS = [
  { id: "project", ko: "고객 · 프로젝트", en: "Customer & project" },
  { id: "chamber", ko: "챔버 선택", en: "Chamber" },
  { id: "parts", ko: "내부 구성품", en: "Components" },
  { id: "resources", ko: "지역 · 인력 · 운송", en: "Region, manpower & transport" },
  { id: "options", ko: "옵션", en: "Options" },
  { id: "summary", ko: "견적 요약", en: "Quotation summary" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

// ---------- 챔버 시트의 치수 입력 셀 찾기 ----------
import type { TemplateSheet } from "@/engine/types";
import { parseCoord } from "@/engine/parser";

export interface DimCells {
  /** 길이 / 폭 / 높이 (F,G,H 열) */
  length?: string;
  width?: string;
  height?: string;
  /** 상승바닥 높이 */
  raisedFloor?: string;
  /** 총 차폐 면적 (계산값) */
  totalShielding?: string;
}

/**
 * 시트에서 치수 입력 행을 찾아 셀 좌표를 돌려준다.
 * 라벨은 시트마다 다르다 —
 *   "Outside shielding dimensions L x W x H"  (대부분의 챔버 · CR/AR/SR)
 *   "Dimensions L x W x H"                    (SAC-10 Plus, Antenna, RVC S/M/L, Reverberation)
 */
const DIM_LABEL_RE = /dimensions\s*l\s*[x*×]\s*w\s*[x*×]\s*h/i;

export function findDimCells(sheet: TemplateSheet): DimCells {
  const out: DimCells = {};
  for (const [coord, cell] of Object.entries(sheet.cells)) {
    if (cell.f !== undefined || typeof cell.v !== "string") continue;
    const v = cell.v.toLowerCase();
    const { row } = parseCoord(coord);
    if (!out.length && (v.includes("outside shielding dimensions") || DIM_LABEL_RE.test(v))) {
      out.length = `F${row}`;
      out.width = `G${row}`;
      out.height = `H${row}`;
    } else if (!out.raisedFloor && v.includes("raised floor") && !v.includes("height")) {
      out.raisedFloor = `H${row}`;
    } else if (!out.totalShielding && v.includes("total shielding")) {
      out.totalShielding = `F${row}`;
    }
  }
  return out;
}

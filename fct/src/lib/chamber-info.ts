/**
 * 챔버 소개 자료 — 썸네일 · 한 줄 설명 · 카탈로그 사양.
 *
 * 출처는 프랑코니아 코리아 웹사이트(frankonia-korea.com)의 챔버 모델 페이지이며,
 * 문구와 수치는 본사 Anechoic Chambers 2026 카탈로그 표기를 그대로 옮긴 것이다.
 * (원본: Frankona-Korea/landing-page — app/chamber-sections.ts · chamber-gallery.ts,
 *  이미지: public/chambers/models/*.webp 를 720px 로 축소해 public/chambers/ 에 둠)
 *
 * 모델 designation 은 번역하지 않는다 — 견적서·도면과 이름이 어긋나면 안 된다.
 */

export interface ChamberInfo {
  /** 웹사이트 모델 slug */
  slug: string;
  /** 본사 표기 모델명 */
  model: string;
  /** 포트폴리오 카드의 한 줄 설명 (영문 원문) */
  desc: string;
  /** 외형 치수 L × W × H */
  size?: string;
  /** 주파수 범위와 흡수체 사양 */
  range?: string;
  /** 측정 거리 / Quiet zone 등 부가 설명 */
  note?: string;
  /** 썸네일 (public/chambers/) — 첫 장이 대표 이미지 */
  shots: string[];
}

const M: Record<string, ChamberInfo> = {
  chc: {
    slug: "chc", model: "CHC",
    desc: "3.0 m Compact Hybrid Chamber — pre-compliant emission and full compliant immunity at 3.0 m",
    size: "7,355 × 3,755 × 3,300 mm",
    note: "Quiet zone ø1.2 m at 3.0 m test distance",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["chc-2.webp", "chc-0.webp"],
  },
  "chc-plus": {
    slug: "chc-plus", model: "CHC Plus",
    desc: "Compact Hybrid Chamber in the advanced setup, adding compliant emission measurement from 1 GHz to 18 GHz",
    size: "7,355 × 3,755 × 3,300 mm",
    note: "Quiet zone ø1.2 m at 3.0 m test distance, compliant emission above 1 GHz",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["chc-plus-2.webp", "chc-plus-0.webp"],
  },
  ctc: {
    slug: "ctc", model: "CTC",
    desc: "Full compliant component test chamber focused on immunity testing for industrial, automotive and military components",
    size: "8,480 × 5,485 × 3,750 mm",
    note: "Full compliant immunity per IEC 61000-4-3; CISPR 25, ISO 11452, MIL-STD 461 and DO-160",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["ctc-1.webp", "ctc-2.webp"],
  },
  "fac-3": {
    slug: "fac-3", model: "FAC-3",
    desc: "3.0 m Fully Anechoic Chamber for free-space EMC tests on table-top EUTs",
    size: "8,705 × 4,655 × 3,750 mm",
    note: "Quiet zone ø1.5 m at 3.0 m test distance (H = 1.5 m), table-top products",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["fac-3-2.webp", "fac-3-0.webp"],
  },
  "fac-3-l": {
    slug: "fac-3-l", model: "FAC-3 L",
    desc: "Extended 3.0 m Fully Anechoic Chamber for floor-standing as well as table-top EUTs, with height scan",
    size: "9,380 × 5,780 × 6,000 mm",
    note: "Quiet zone ø1.5 m at 3.0 m test distance (H = 2.0 m), floor-standing and table-top products",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["fac-3-l-2.webp", "fac-3-l-0.webp"],
  },
  "sac-3-plus": {
    slug: "sac-3-plus", model: "SAC-3 Plus",
    desc: "3.0 m Semi Anechoic Chamber in dome design — the most selected chamber in its class, for full compliant emission and immunity",
    size: "9,680 × 6,530 × 6,000 mm",
    note: "Quiet zone ø2.0 m at 3.0 m test distance (H = 2.0 m); ø1.2–2.0 m across the S, M and L sizes",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["sac-3-plus-1.webp", "sac-3-plus-0.webp"],
  },
  "sac-3-square": {
    slug: "sac-3-square", model: "SAC-3 Square",
    desc: "3.0 m Semi Anechoic Chamber in the traditional square design",
    size: "9,680 × 6,530 × 6,000 mm",
    note: "Quiet zone ø2.0 m at 3.0 m test distance (H = 2.5 m)",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["sac-3-square-1.webp", "sac-3-square-0.webp"],
  },
  "sac-5-plus": {
    slug: "sac-5-plus", model: "SAC-5 Plus",
    desc: "5.0 m Semi Anechoic Chamber in dome design, covering both 3.0 m and 5.0 m test distances",
    size: "12,680 × 7,730 × 6,300 mm",
    note: "Quiet zone ø2.0 m at 3.0 m and 5.0 m test distance (H = 2.5 m)",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["sac-5-plus-1.webp", "sac-5-plus-0.webp"],
  },
  "sac-5-square": {
    slug: "sac-5-square", model: "SAC-5 Square",
    desc: "5.0 m Semi Anechoic Chamber in the traditional square design, covering 3.0 m and 5.0 m test distances",
    size: "12,680 × 7,730 × 6,000 mm",
    note: "Quiet zone ø2.0 m at 3.0 m and 5.0 m test distance (H = 2.5 m)",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["sac-5-square-1.webp", "sac-5-square-0.webp"],
  },
  "sac-3-fac-3-transformer": {
    slug: "sac-3-fac-3-transformer", model: "SAC-3 / FAC-3 Transformer",
    desc: "One chamber convertible between semi-anechoic with ground plane and fully anechoic with floor absorbers",
    size: "9,680 × 6,530 × 6,000 mm",
    note: "SAC setup: quiet zone ø2.0 m (H = 2.5 m) · FAC setup: ø1.5 m (H = 1.5 m), both at 3.0 m",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["sac-3-fac-3-transformer-1.webp", "sac-3-fac-3-transformer-0.webp"],
  },
  "sac-10-plus-triton": {
    slug: "sac-10-plus-triton", model: "SAC-10 Plus / Triton",
    desc: "10.0 m Semi Anechoic Chamber with three independent test axes in one polygonal shell — the most compact 10.0 m chamber Frankonia builds",
    size: "19,205 × 12,080 × 8,325 mm",
    note: "Quiet zone ø3.0 m (H = 3.0 m) — one 10.0 m axis and two 3.0 m axes, antennas and floor absorbers staying in place",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["triton-2.webp", "triton-4.webp"],
  },
  "sac-10-h-hybrid": {
    slug: "sac-10-h-hybrid", model: "SAC-10/H Hybrid",
    desc: "10.0 m Semi Anechoic Chamber lined with Frankosorb hybrid absorbers, sized to the quiet zone required",
    size: "18,380 × 12,830 × 8,550 mm (ø3.0 m) up to 21,680 × 15,680 × 8,700 mm (ø6.0 m)",
    note: "Quiet zone ø3.0 m to ø6.0 m at 10.0 m test distance (H = 3.0 m)",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["sac-10-h-hybrid-1.webp", "sac-10-h-hybrid-0.webp"],
  },
  "sac-10-p-pyramid": {
    slug: "sac-10-p-pyramid", model: "SAC-10/P Pyramid",
    desc: "10.0 m Semi Anechoic Chamber fully lined with Frankosorb long-pyramid absorbers, a cost-efficient alternative to the hybrid lining",
    size: "21,680 × 13,730 × 8,550 mm (ø3.0 m) up to 24,980 × 17,180 × 9,000 mm (ø6.0 m)",
    note: "Quiet zone ø3.0 m to ø6.0 m at 10.0 m test distance (H = 3.0 m)",
    range: "9 kHz / 30 MHz – 18 GHz (40 GHz option)",
    shots: ["sac-10-p-pyramid-2.webp", "sac-10-p-pyramid-0.webp"],
  },
  "mil-chc": {
    slug: "mil-chc", model: "MIL CHC",
    desc: "Compact Hybrid Chamber for military component testing",
    size: "4,880 × 4,880 × 3,000 mm",
    range: "9 kHz / 30 MHz – 40 GHz, hybrid absorber lining",
    shots: ["mil-chc-2.webp", "mil-chc-0.webp"],
  },
  "mil-std-chamber": {
    slug: "mil-std-chamber", model: "MIL-STD Chamber",
    desc: "Military Testing Chamber for Vehicles and large EUTs",
    size: "Custom size",
    range: "9 kHz / 80 MHz – 40 GHz, short-pyramid absorbers",
    shots: ["mil-std-chamber-0.webp", "mil-std-chamber-1.webp"],
  },
  "mil-std-chamber-advanced": {
    slug: "mil-std-chamber-advanced", model: "MIL-STD Chamber Advanced",
    desc: "Military Testing Chamber for Vehicles and large EUTs, also compliant with commercial and automotive test site requirements",
    size: "Custom size",
    range: "9 kHz / 26 MHz – 40 GHz long-pyramid, or 30 MHz – 40 GHz hybrid",
    shots: ["mil-std-chamber-advanced-3.webp", "mil-std-chamber-advanced-2.webp"],
  },
  actc: {
    slug: "actc", model: "ACTC",
    desc: "CISPR 25 Automotive Component Testing Chamber",
    size: "6,380 × 5,480 × 3,750 mm",
    note: "CISPR 25 component level at 1.0 m test distance",
    range: "150 kHz / 26 MHz – 18 GHz (40 GHz option)",
    shots: ["actc-1.webp", "actc-0.webp"],
  },
  ucc: {
    slug: "ucc", model: "UCC",
    desc: "Ultra-compact hybrid chamber for pre-compliance component testing, an alternative to the GTEM cell",
    size: "4,580 × 3,080 × 2,550 mm",
    note: "Pre-compliant component level at 1.0 m test distance",
    range: "150 kHz / 26 MHz – 18 GHz (40 GHz option)",
    shots: ["ucc-2.webp", "ucc-0.webp"],
  },
  avtc: {
    slug: "avtc", model: "AVTC",
    desc: "3.0 m Automotive Vehicle Testing Chamber for component and full-vehicle tests",
    size: "11,480 × 9,380 × 6,000 mm",
    note: "Quiet zone ø3.0 m at 3.0 m test distance (H = 2.5 m)",
    range: "9 kHz / 150 kHz – 18 GHz (40 GHz option)",
    shots: ["avtc-4.webp", "avtc-3.webp"],
  },
  "sac-10-v": {
    slug: "sac-10-v", model: "SAC-10V",
    desc: "10.0 m Semi Anechoic Chamber for ECE R10 vehicle testing with integrated dynamometer",
    size: "22,580 × 15,680 × 8,700 mm",
    note: "Quiet zone ø6.0 m at 10.0 m test distance (H = 3.0 m)",
    range: "9 kHz / 150 kHz – 18 GHz (40 GHz option)",
    shots: ["sac-10-v-5.webp", "sac-10-v-6.webp"],
  },
  "edtc-sa": {
    slug: "edtc-sa", model: "EDTC-SA",
    desc: "E-Drive test chamber prepared for a single external load machine with fixed shaft",
    size: "7,880 × 5,480 × 3,750 mm",
    note: "Fixed-shaft version, e.g. 1 × 250 kW at 3,000 RPM and 3,000 Nm",
    shots: ["edtc-3.webp", "edtc-1.webp"],
  },
  "edtc-bb": {
    slug: "edtc-bb", model: "EDTC-BB",
    desc: "E-Drive test chamber including the EMC-BlueBox mobile load machine for dynamic powertrain tests",
    size: "7,880 × 6,380 × 3,750 mm",
    note: "For the EMC-BlueBox mobile load machine up to 120 kW",
    shots: ["edtc-bb-0.webp", "edtc-bb-1.webp"],
  },
  "rvc-s": {
    slug: "rvc-s", model: "RVC S",
    desc: "Reverberation chamber for military and automotive components",
    size: "5,330 × 3,380 × 3,300 mm",
    note: "Working volume 2.5 × 1.0 × 1.5 m · 1 × Z-fold stirrer (vertical)",
    range: "Lowest usable frequency 200 MHz",
    shots: ["reverberation-solutions-0.webp", "reverberation-solutions-1.webp"],
  },
  "rvc-m": {
    slug: "rvc-m", model: "RVC M",
    desc: "Reverberation chamber for large military and automotive components",
    size: "7,580 × 5,630 × 4,200 mm",
    note: "Working volume 3.3 × 3.5 × 2.6 m · 1 × Z-fold stirrer (vertical)",
    range: "Lowest usable frequency 200 MHz",
    shots: ["reverberation-solutions-0.webp", "reverberation-solutions-1.webp"],
  },
  "rvc-l": {
    slug: "rvc-l", model: "RVC L",
    desc: "Reverberation chamber for vehicles",
    size: "13,880 × 11,480 × 6,300 mm (custom)",
    note: "Working volume 8.0 × 5.0 × 3.0 m · 2 × Z-fold stirrer (vertical and horizontal)",
    range: "Lowest usable frequency 80 MHz",
    shots: ["reverberation-solutions-0.webp", "reverberation-solutions-1.webp"],
  },
  "shielded-room": {
    slug: "shielded-room", model: "Shielded Room",
    desc: "Modular and pre-fabricated shielded room built from PAN type panels",
    size: "Any size — modular PAN type panels",
    range: "10 kHz – 18 GHz, or 40 GHz as an option, acc. EN 50147-1 / IEEE-299",
    shots: ["shielded-room-7.webp", "shielded-room-6.webp"],
  },
};

/**
 * Total 시트 행 번호 → 소개 자료.
 * 여러 사이즈(L/XL 등)가 한 모델 페이지를 공유하는 경우가 있어 행 단위로 잇는다.
 * 사이트에 대응 모델이 없는 행(MIL CPC 31, Antenna Chamber 45)은 비워 둔다 —
 * 없는 자료를 지어내지 않는다.
 */
const BY_ROW: Record<number, string> = {
  9: "chc", 10: "chc-plus", 11: "chc-plus", 12: "ctc",
  13: "fac-3", 14: "fac-3-l",
  15: "sac-3-plus", 16: "sac-3-plus", 17: "sac-5-plus",
  18: "sac-3-square", 19: "sac-5-square",
  20: "sac-3-fac-3-transformer", 21: "sac-10-plus-triton",
  22: "sac-10-h-hybrid", 23: "sac-10-h-hybrid", 24: "sac-10-h-hybrid", 25: "sac-10-h-hybrid",
  26: "sac-10-p-pyramid", 27: "sac-10-p-pyramid", 28: "sac-10-p-pyramid", 29: "sac-10-p-pyramid",
  30: "mil-chc", 32: "mil-std-chamber", 33: "mil-std-chamber-advanced",
  34: "actc", 35: "actc", 36: "ucc",
  37: "avtc", 38: "avtc", 39: "avtc",
  40: "sac-10-v", 41: "sac-10-v", 42: "sac-10-v",
  43: "edtc-sa", 44: "edtc-bb",
  46: "rvc-s", 47: "rvc-m", 48: "rvc-l",
  49: "shielded-room", 50: "shielded-room", 51: "shielded-room", 52: "shielded-room",
};

export function chamberInfo(row: number): ChamberInfo | null {
  const key = BY_ROW[row];
  return key ? (M[key] ?? null) : null;
}

export const CHAMBER_IMG = "/chambers/";

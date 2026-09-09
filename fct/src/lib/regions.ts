/**
 * 국가/지역 프리셋 — 국가를 고르면 감독자·작업자 유형, 출장 지역, 운송 조건을 자동으로 맞춘다.
 *
 * 가격 DB의 드롭다운 문자열이 리비전마다 조금씩 달라질 수 있어(공백·표기),
 * 정확한 문자열 대신 "매칭 토큰"을 두고 실제 옵션 목록에서 찾아 쓴다.
 */

export interface RegionPreset {
  /** 국가 코드 (ISO 2자리 또는 임의 키) */
  code: string;
  ko: string;
  en: string;
  /** 감독자 옵션 매칭 토큰 (Supervisor 목록에서 검색) */
  sv: string;
  /** 작업자 옵션 매칭 토큰 (Manpower 목록에서 검색) */
  worker: string;
  /** 출장 지역 (Travel_cost 목록) */
  travel: string;
  /** 운송 조건 (Type_of_transportation 목록) */
  transport: string;
  /** 현지 인력 대안 (있으면 4단계에서 선택지로 제시) */
  localWorker?: string;
  /** EU 역내 여부 — 전기 안전점검(DGUV) 항목 안내에 사용 */
  eu?: boolean;
}

export const REGIONS: RegionPreset[] = [
  { code: "DE", ko: "독일", en: "Germany", sv: "-> DE", worker: "-> DE", travel: "Germany", transport: "Truck from Poland to site in Germany", eu: true },
  { code: "EU", ko: "유럽 (기타)", en: "Europe (other)", sv: "-> EU", worker: "-> EU", travel: "Europe", transport: "Truck from Poland to site in Europe", eu: true },
  { code: "SCA", ko: "북유럽", en: "Scandinavia", sv: "Scandinavia", worker: "Scandinavia", travel: "Europe", transport: "Truck from Poland to site in Europe", eu: true },
  { code: "TR", ko: "터키", en: "Turkey", sv: "-> TR", worker: "-> TR", travel: "Turkey", transport: "CIP Istanbul", localWorker: "Local worker Turkey" },
  { code: "KR", ko: "한국", en: "Korea", sv: "-> JP", worker: "-> JP", travel: "Japan/Korea", transport: "CIF Busan" },
  { code: "JP", ko: "일본", en: "Japan", sv: "-> JP", worker: "-> JP", travel: "Japan/Korea", transport: "CIF Osaka" },
  { code: "CN", ko: "중국", en: "China", sv: "-> China", worker: "-> China", travel: "China", transport: "CIF China Harbor", localWorker: "Local worker China" },
  { code: "IN", ko: "인도", en: "India", sv: "-> India", worker: "-> India", travel: "India", transport: "CIF India Harbor", localWorker: "Local Fitter by FRI" },
  { code: "SG", ko: "싱가포르", en: "Singapore", sv: "-> SGP", worker: "-> SGP", travel: "Asia", transport: "CIF Singapore", localWorker: "Local worker Asia- SGP" },
  { code: "TH", ko: "태국", en: "Thailand", sv: "-> Asia", worker: "-> Asia", travel: "Asia", transport: "CIF Bangkok", localWorker: "Local worker Asia" },
  { code: "ASIA", ko: "동남아 (기타)", en: "Southeast Asia (other)", sv: "-> Asia", worker: "-> Asia", travel: "Asia", transport: "CIF Singapore", localWorker: "Local worker Asia" },
  { code: "US-E", ko: "미국 (동부)", en: "USA (East)", sv: "-> Americas", worker: "-> Americas", travel: "Americas", transport: "CIF United States Harbor - East Coast" },
  { code: "US-W", ko: "미국 (서부)", en: "USA (West)", sv: "-> Americas", worker: "-> Americas", travel: "Americas", transport: "CIF United States Harbor - West Coast" },
  { code: "BR", ko: "브라질", en: "Brazil", sv: "BR, MX", worker: "BR, MX", travel: "Americas", transport: "CIF Santos", localWorker: "Local worker Brazil" },
  { code: "MX", ko: "멕시코", en: "Mexico", sv: "BR, MX", worker: "BR, MX", travel: "Americas", transport: "DAP United States, CA Area" },
  { code: "AU", ko: "호주", en: "Australia", sv: "-> AUS", worker: "-> AUS", travel: "Australia", transport: "CIF Brisbane", localWorker: "Local worker Australia" },
  { code: "NZ", ko: "뉴질랜드", en: "New Zealand", sv: "-> AUS", worker: "-> AUS", travel: "Australia", transport: "CIF Auckland" },
];

/** 옵션 목록에서 토큰이 포함된 첫 항목을 찾는다 (대소문자·공백 무시) */
export function matchOption(options: string[], token: string): string | undefined {
  const t = token.toLowerCase().replace(/\s+/g, " ").trim();
  return (
    options.find((o) => o.toLowerCase().replace(/\s+/g, " ").trim() === t) ??
    options.find((o) => o.toLowerCase().replace(/\s+/g, " ").includes(t))
  );
}

export function findRegion(code: string): RegionPreset | undefined {
  return REGIONS.find((r) => r.code === code);
}

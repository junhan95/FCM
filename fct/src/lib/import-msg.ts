import type { Lang } from "./i18n";

/**
 * 엑셀 불러오기 과정에서 사용자에게 보여 주는 오류·경고 문구.
 * 서버(API 라우트·파서)에서 만들어지므로 i18n 사전과 달리 값이 끼워 넣어진 문장이다.
 */
export interface ImportMsg {
  noFile: string;
  tooBig: (mb: number) => string;
  notXlsx: string;
  readFailed: string;
  cannotOpen: string;
  noTotalSheet: string;
  noChamberHeader: string;
  movedFar: (sheet: string, ref: string) => string;
  refNotInDb: (sheet: string, ref: string) => string;
  lostItems: (sheet: string, n: number) => string;
  tooManyCells: (max: number) => string;
  removedRows: (n: number) => string;
  unknownSheets: (list: string) => string;
  revisionMismatch: (fileRev: string, tplRev: string) => string;
  noChambers: string;
}

const KO: ImportMsg = {
  noFile: "파일이 없습니다.",
  tooBig: (mb) => `파일이 너무 큽니다 (최대 ${mb}MB).`,
  notXlsx: ".xlsx 파일만 불러올 수 있습니다.",
  readFailed: "파일을 읽지 못했습니다.",
  cannotOpen: "엑셀 파일을 열 수 없습니다. 손상되었거나 .xlsx 형식이 아닙니다.",
  noTotalSheet: "'Total' 시트가 없습니다. Frankonia 계산표(Global calculation table) 파일이 맞는지 확인하세요.",
  noChamberHeader: "'Total' 시트에서 챔버 표(Chamber Type / Incl.)를 찾지 못했습니다. Frankonia 계산표 형식이 아닙니다.",
  movedFar: (sheet, ref) => `'${sheet}' 시트의 추가 품목(Ref ${ref})을 원래 위치와 먼 예비 행에 넣었습니다. 구성품 화면에서 확인하세요.`,
  refNotInDb: (sheet, ref) =>
    `'${sheet}' 시트의 제품 번호 "${ref}" 는 Price DB 에 없습니다. 파일에 적힌 품명과 단가를 그대로 옮겼습니다 — 구성품 화면에서 확인하세요.`,
  lostItems: (sheet, n) => `'${sheet}' 시트에 추가된 품목 ${n}개는 템플릿에 빈 자리가 없어 넣지 못했습니다. 직접 추가하세요.`,
  tooManyCells: (max) => `가져올 값이 너무 많아 ${max.toLocaleString()}개에서 중단했습니다.`,
  removedRows: (n) => `파일에서 지워진 ${n}개 품목은 견적에서 제외(수량 0)했습니다.`,
  unknownSheets: (list) => `템플릿에 없는 시트는 건너뛰었습니다: ${list}`,
  revisionMismatch: (f, t) => `파일은 ${f} 로 작성되었습니다. 최신 템플릿 ${t} 과 현재 가격 DB 로 다시 계산하므로 금액이 달라질 수 있습니다.`,
  noChambers: "수량이 입력된 챔버가 없습니다. 빈 템플릿일 수 있습니다.",
};

const EN: ImportMsg = {
  noFile: "No file was uploaded.",
  tooBig: (mb) => `File is too large (max ${mb} MB).`,
  notXlsx: "Only .xlsx files can be imported.",
  readFailed: "The file could not be read.",
  cannotOpen: "The Excel file could not be opened. It is damaged or not a .xlsx file.",
  noTotalSheet: "No 'Total' sheet found. Please check that this is a Frankonia Global calculation table file.",
  noChamberHeader: "The chamber table (Chamber Type / Incl.) was not found on the 'Total' sheet. This is not a Frankonia calculation table.",
  movedFar: (sheet, ref) =>
    `An item added by hand on sheet '${sheet}' (Ref ${ref}) was placed in a spare row far from its original position. Please check it on the Components step.`,
  refNotInDb: (sheet, ref) =>
    `Product number "${ref}" on sheet '${sheet}' is not in the price DB. The description and unit price written in the file were carried over instead — please check it on the Components step.`,
  lostItems: (sheet, n) => `${n} item(s) added on sheet '${sheet}' could not be imported — no spare row left in the template. Please add them manually.`,
  tooManyCells: (max) => `Too many values to import — stopped at ${max.toLocaleString()}.`,
  removedRows: (n) => `${n} item(s) deleted in the file were excluded from the quotation (quantity set to 0).`,
  unknownSheets: (list) => `Sheets not present in the template were skipped: ${list}`,
  revisionMismatch: (f, t) =>
    `The file was created with ${f}. It is recalculated with the latest template ${t} and the current price DB, so amounts may differ.`,
  noChambers: "No chamber has a quantity. This may be an empty template.",
};

export function importMsg(lang: Lang): ImportMsg {
  return lang === "en" ? EN : KO;
}

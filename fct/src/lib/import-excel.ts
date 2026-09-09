/**
 * 엑셀 견적서 불러오기
 *
 * 실제 현장 파일은 템플릿을 그대로 쓰지 않는다 — 영업담당자가 쓰지 않는 시트를 지우고,
 * 필요 없는 행을 삭제하거나 항목을 끼워 넣는다. 따라서 좌표를 그대로 믿을 수 없고,
 * 행을 "내용(품목 Ref·설명)" 기준으로 템플릿 행에 다시 맞춘 뒤 값을 옮긴다.
 *
 *   1) 시트별로 행 키를 만들고 LCS 정렬로 파일 행 → 템플릿 행 대응표를 만든다
 *      - Total 시트: B열(챔버명·구획 라벨)만 사용 (A열 품번은 사용자 입력이라 불안정)
 *      - 그 외 시트: A열(Ref 단가번호) + B열(설명) + C열(비고)
 *   2) 키가 빈 행(설정값만 있는 행 등)은 앞뒤 기준점의 행 간격으로 보간하되,
 *      템플릿 쪽 키도 비어 있을 때만 인정한다 (엉뚱한 행에 값이 들어가는 것을 막는다)
 *   3) 대응된 행에서 "사람이 입력한 값"만 골라 overrides 로 만든다
 *      - 파일 셀이 수식이면 템플릿 로직이므로 무시
 *      - 템플릿이 수식인 자리에 값이 있으면 수동 덮어쓰기로 인정
 *      - 가격(Prices resume)은 DB 로 중앙 관리하므로 가져오지 않음
 */
import ExcelJS from "exceljs";
import { Overrides, Scalar, Template, TemplateSheet, PRICES_SHEET } from "@/engine/types";
import { parseCoord } from "@/engine/parser";
import { buildLayout } from "@/engine/layout";
import type { Lang } from "./i18n";
import { importMsg } from "./import-msg";

export interface ImportPreview {
  fileRevision: string | null;
  templateRevision: string;
  revisionMismatch: boolean;
  meta: { title: string; quotation: string; editor: string };
  chambers: { row: number; name: string; qty: number }[];
  perSheet: { sheet: string; cells: number; alignedRows: number; skippedRows: number; insertedRows: number }[];
  /** 담당자가 끼워 넣은 품목 중 템플릿 예비 행으로 옮긴 것 */
  movedItems: { sheet: string; ref: string; description: string; qty: number }[];
  totalCells: number;
  /** 파일에 저장돼 있던 최종가 (참고용) */
  fileFinalPrice: number | null;
  /** 파일에 있었지만 템플릿에 없는 시트 */
  unknownSheets: string[];
  warnings: string[];
  overrides: Overrides;
}

const MAX_CELLS = 40000;
const MAX_COL = 40; // AN 열까지만 (그 뒤는 보조 표)

// ---------- 셀 읽기 ----------
/** 셀 하나의 상태 — 공유 수식(shared formula)도 cell.formula 로 원래 수식을 얻는다 */
function cellInfo(cell: ExcelJS.Cell): { value: Scalar | null; isFormula: boolean; formula?: string; isMergeSlave: boolean } {
  const isMergeSlave = cell.type === ExcelJS.ValueType.Merge;
  if (cell.type === ExcelJS.ValueType.Formula) return { value: null, isFormula: true, formula: cell.formula, isMergeSlave };
  if (isMergeSlave) return { value: null, isFormula: false, isMergeSlave };
  return { ...readCell(cell.value), isMergeSlave };
}

function readCell(v: ExcelJS.CellValue): { value: Scalar | null; isFormula: boolean } {
  if (v === null || v === undefined) return { value: null, isFormula: false };
  if (typeof v === "number") return { value: v, isFormula: false };
  if (typeof v === "string") return { value: v, isFormula: false };
  if (typeof v === "boolean") return { value: v, isFormula: false };
  if (v instanceof Date) return { value: v.toISOString().slice(0, 10), isFormula: false };
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if ("formula" in o || "sharedFormula" in o) return { value: null, isFormula: true };
    if ("richText" in o) return { value: (o.richText as { text: string }[]).map((r) => r.text).join(""), isFormula: false };
    if ("error" in o) return { value: null, isFormula: true };
    if ("text" in o) return { value: String(o.text), isFormula: false };
    if ("result" in o) return { value: null, isFormula: true };
  }
  return { value: null, isFormula: false };
}

/** 표시용 — 수식 셀이면 엑셀이 저장해 둔 결과값을 돌려준다 */
function cachedValue(cell: ExcelJS.Cell): Scalar | null {
  const v = cell.value;
  if (v && typeof v === "object" && "result" in v) {
    const r = (v as { result: unknown }).result;
    if (typeof r === "number" || typeof r === "string") return r;
    return null;
  }
  return cellInfo(cell).value;
}

/** 행 키 정규화 — 수식은 행 번호를 지워 같은 유형끼리 같은 키가 되게 한다 */
function norm(v: Scalar | null, isFormula: boolean, formula?: string): string {
  if (isFormula && formula) return "=" + formula.replace(/(?<=[A-Z$])\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 90);
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim().slice(0, 90);
}

function fileRowKey(ws: ExcelJS.Worksheet, row: number, cols: number[]): string {
  return cols
    .map((c) => {
      const info = cellInfo(ws.getCell(row, c));
      return info.isFormula ? norm(null, true, info.formula) : norm(info.value, false);
    })
    .join("|");
}

function tplRowKey(sheet: TemplateSheet, row: number, colLetters: string[]): string {
  return colLetters
    .map((L) => {
      const c = sheet.cells[`${L}${row}`];
      if (!c) return "";
      if (c.f !== undefined) return norm(null, true, c.f);
      return norm(c.v ?? null, false);
    })
    .join("|");
}

/** 최장 공통 부분수열 정렬 — 삭제/삽입된 행이 있어도 순서를 지키며 대응시킨다 */
function lcsAlign(a: string[], b: string[], emptyKey: string): [number, number][] {
  const n = a.length,
    m = b.length;
  // dp[i][j] = a[i..], b[j..] 의 LCS 길이 (Int32Array 로 메모리 절약)
  const dp = new Int32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => dp[i * (m + 1) + j];
  for (let i = n - 1; i >= 0; i--) {
    const ai = a[i];
    for (let j = m - 1; j >= 0; j--) {
      dp[i * (m + 1) + j] =
        ai === b[j] && ai !== emptyKey ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const out: [number, number][] = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j] && a[i] !== emptyKey) {
      out.push([i, j]);
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) i++;
    else j++;
  }
  return out;
}

function sameValue(a: Scalar | null | undefined, b: Scalar | null | undefined): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a));
  return String(a).trim() === String(b).trim();
}

/**
 * 템플릿의 "예비 행" — A열이 리터럴 0 이고 B열이 Prices VLOOKUP 인 행.
 * 엑셀에서 담당자가 Ref 번호만 적어 넣으면 품명·단가가 자동으로 채워지는 자리다.
 */
function findSpareRows(tpl: TemplateSheet): number[] {
  const out: number[] = [];
  for (const [coord, cell] of Object.entries(tpl.cells)) {
    if (cell.f !== undefined || cell.v !== 0) continue;
    const { col, row } = parseCoord(coord);
    if (col !== 1) continue;
    const b = tpl.cells[`B${row}`];
    if (!b?.f || !/VLOOKUP/i.test(b.f)) continue;
    out.push(row);
  }
  return out.sort((a, b) => a - b);
}

/** 파일 행 → 템플릿 행 대응표 만들기 */
function buildRowMap(ws: ExcelJS.Worksheet, tpl: TemplateSheet, isTotal: boolean) {
  const fileCols = isTotal ? [2] : [1, 2, 3];
  const tplCols = isTotal ? ["B"] : ["A", "B", "C"];
  const emptyKey = new Array(fileCols.length).fill("").join("|");

  const fMax = Math.min(ws.rowCount, tpl.maxRow + 200);
  const fKeys: string[] = [];
  for (let r = 1; r <= fMax; r++) fKeys.push(fileRowKey(ws, r, fileCols));
  const tKeys: string[] = [];
  for (let r = 1; r <= tpl.maxRow; r++) tKeys.push(tplRowKey(tpl, r, tplCols));

  const pairs = lcsAlign(fKeys, tKeys, emptyKey);
  const map = new Map<number, number>();
  for (const [i, j] of pairs) map.set(i + 1, j + 1);
  /** 정렬되지 않은(=담당자가 끼워 넣은) 행과 그 앞뒤 템플릿 위치 */
  const unaligned: { fileRow: number; prevTpl: number; nextTpl: number }[] = [];

  // 키가 빈 행 보간 — 기준점의 행 간격을 쓰되, 템플릿 쪽 키도 비어 있어야 인정
  const anchors = pairs.map(([i, j]) => [i + 1, j + 1] as const);
  let skipped = 0;
  for (let r = 1; r <= fMax; r++) {
    if (map.has(r)) continue;
    if (fKeys[r - 1] !== emptyKey) {
      skipped++;
      let prevTpl = 0,
        nextTpl = tpl.maxRow + 1;
      for (const [i, j] of pairs) {
        if (i + 1 < r) prevTpl = j + 1;
        else if (i + 1 > r) {
          nextTpl = j + 1;
          break;
        }
      }
      unaligned.push({ fileRow: r, prevTpl, nextTpl });
      continue;
    }
    // 가장 가까운 기준점 찾기
    let base: readonly [number, number] | null = null;
    for (const a of anchors) {
      if (a[0] <= r) base = a;
      else {
        if (!base) base = a; // 첫 기준점보다 위쪽 행
        break;
      }
    }
    if (!base) continue;
    const target = r + (base[1] - base[0]);
    if (target < 1 || target > tpl.maxRow) continue;
    if (tKeys[target - 1] !== emptyKey) continue; // 템플릿 쪽에 라벨이 있으면 위험 → 포기
    map.set(r, target);
  }

  // ---------- Total 시트 보정 ----------
  // 개정판마다 챔버 이름이 바뀌기도 한다 (rev-x3.9 "Antenna Calibration Chamber" → x3.10 "Antenna Chamber").
  // 이름으로 못 붙은 행은 E열이 가리키는 **시트 이름**으로 다시 맞춰 본다. 시트 이름은 개정판이 바뀌어도 그대로다.
  if (isTotal && unaligned.length) {
    const refSheet = (f?: string | null) => {
      if (!f) return null;
      const m = /^=?\s*'([^']+)'!|^=?\s*([A-Za-z][A-Za-z0-9\- ]*?)!/.exec(f);
      return m ? (m[1] ?? m[2]) : null;
    };
    const tplBySheet = new Map<string, number[]>();
    for (let r = 1; r <= tpl.maxRow; r++) {
      const name = refSheet(tpl.cells[`E${r}`]?.f);
      if (!name) continue;
      const arr = tplBySheet.get(name) ?? [];
      arr.push(r);
      tplBySheet.set(name, arr);
    }
    const usedTpl = new Set(map.values());
    for (let i = unaligned.length - 1; i >= 0; i--) {
      const u = unaligned[i];
      const info = cellInfo(ws.getCell(u.fileRow, 5));
      const name = info.isFormula ? refSheet(info.formula) : null;
      if (!name) continue;
      const cands = (tplBySheet.get(name) ?? []).filter((r) => !usedTpl.has(r));
      // 한 시트를 여러 행이 쓰는 경우(SAC-10 계열 등)는 어느 줄인지 알 수 없으니 손대지 않는다
      if (cands.length !== 1) continue;
      map.set(u.fileRow, cands[0]);
      usedTpl.add(cands[0]);
      unaligned.splice(i, 1);
      skipped--;
    }
  }

  return { map, skipped, matched: pairs.length, unaligned };
}

export async function parseQuotationWorkbook(
  buffer: ArrayBuffer,
  template: Template,
  templateRevision: string,
  lang: Lang = "ko",
  /** 가격 DB 에 있는 제품 번호 — 파일의 Ref 를 그대로 써도 되는지 판단한다 */
  knownRefs?: Set<string>,
): Promise<ImportPreview> {
  /** 이 Ref 를 템플릿의 VLOOKUP 이 찾을 수 있는가 */
  const refKnown = (v: Scalar | null): boolean => {
    if (v === null || v === undefined || v === "" || v === 0) return false;
    if (!knownRefs) return true; // 목록이 없으면 예전처럼 그대로 믿는다
    return knownRefs.has(String(v).trim().toLowerCase());
  };
  const M = importMsg(lang);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new Error(M.cannotOpen);
  }

  const totalWs = wb.getWorksheet("Total");
  if (!totalWs) throw new Error(M.noTotalSheet);

  // 형태 검증 — 챔버 표 머리글이 있어야 한다
  const headerRow = (() => {
    for (let r = 1; r <= 30; r++) {
      const b = cellInfo(totalWs.getCell(r, 2)).value;
      const c = cellInfo(totalWs.getCell(r, 3)).value;
      if (typeof b === "string" && /chamber type/i.test(b) && typeof c === "string" && /incl/i.test(c)) return r;
    }
    return 0;
  })();
  if (!headerRow)
    throw new Error(M.noChamberHeader);

  const warnings: string[] = [];
  const unknownSheets: string[] = [];
  const overrides: Overrides = {};
  const perSheet: ImportPreview["perSheet"] = [];
  const movedItems: ImportPreview["movedItems"] = [];
  let totalCells = 0;
  let removedRows = 0;

  const fileRevision = (() => {
    const r = cellInfo(totalWs.getCell("O1")).value;
    return typeof r === "string" ? r.trim() : null;
  })();

  for (const ws of wb.worksheets) {
    const name = ws.name;
    if (name === PRICES_SHEET) continue; // 단가는 DB 로 관리
    const tpl = template.sheets[name];
    if (!tpl) {
      unknownSheets.push(name);
      continue;
    }

    const { map, skipped, matched, unaligned } = buildRowMap(ws, tpl, name === "Total");
    const usedTplRows = new Set<number>(map.values());
    let count = 0;
    let inserted = 0;

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const tplRow = map.get(rowNumber);
      if (!tplRow || totalCells >= MAX_CELLS) return;
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colNumber > MAX_COL || totalCells >= MAX_CELLS) return;
        const { value, isFormula, isMergeSlave, formula } = cellInfo(cell);
        if (isMergeSlave) return;

        const coord = cell.address.replace(/\$/g, "").replace(/\d+$/, String(tplRow));
        const t = tpl.cells[coord];

        let v: Scalar | null = value;
        if (isFormula) {
          // 담당자가 손으로 적은 계산식은 결과값을 그대로 가져온다.
          //   · 입력 칸(템플릿이 리터럴)에 =14*6 처럼 적어 넣은 경우
          //   · 템플릿의 VLOOKUP 을 =N38*O38 처럼 갈아 끼운 경우 (품명·단가)
          // 템플릿과 같은 계산식(합계·판매가 등)은 앱이 다시 계산하므로 가져오지 않는다.
          const custom = !/VLOOKUP/i.test(formula ?? "");
          const slot = t !== undefined && (t.f === undefined || /VLOOKUP/i.test(t.f));
          if (!custom || !slot) return;
          v = cachedValue(cell);
        }
        if (v === null) return;
        if (typeof v !== "number" && typeof v !== "string") return;

        if (t && t.f === undefined && sameValue(t.v, v)) return; // 기본값과 같음
        (overrides[name] ??= {})[coord] = v;
        count++;
        totalCells++;
      });
    });

    // ---------- 담당자가 끼워 넣은 품목을 템플릿 예비 행으로 옮긴다 ----------
    if (name !== "Total" && unaligned.length) {
      // 예비 행이 파일의 어떤 행에 대응되더라도, 그 파일 행의 Ref 가 비어 있으면 여전히 빈 자리다
      const fileRowOfTpl = new Map<number, number>();
      for (const [fr, tr] of map) fileRowOfTpl.set(tr, fr);
      const spare = findSpareRows(tpl).filter((r) => {
        const fr = fileRowOfTpl.get(r);
        if (fr === undefined) return true; // 파일에서 지워진 예비 행
        const a = cellInfo(ws.getCell(fr, 1));
        return a.isFormula || a.value === null || a.value === 0 || a.value === "";
      });
      void usedTplRows;
      const taken = new Set<number>();
      let lost = 0;
      for (const u of unaligned) {
        const refInfo = cellInfo(ws.getCell(u.fileRow, 1));
        const ref = refInfo.isFormula ? null : refInfo.value;
        if (ref === null || ref === undefined || ref === 0 || ref === "") continue;
        // 수량이 0 이거나 없으면 옮길 필요 없음
        const qtyInfo = cellInfo(ws.getCell(u.fileRow, 6));
        const ynInfo = cellInfo(ws.getCell(u.fileRow, 4));
        const yn = typeof ynInfo.value === "string" && /^[YN]$/i.test(ynInfo.value.trim()) ? ynInfo.value.trim().toUpperCase() : null;
        const qty = typeof qtyInfo.value === "number" ? qtyInfo.value : null;
        if (qty === null && yn !== "Y") continue;
        if (qty !== null && qty === 0) continue;

        // 같은 구획(앞뒤 정렬 기준점 사이)의 빈 예비 행 우선, 없으면 원래 위치에서 가장 가까운 행
        let slot = spare.find((r) => !taken.has(r) && r > u.prevTpl && r < u.nextTpl);
        if (slot === undefined) {
          const free = spare.filter((r) => !taken.has(r));
          if (free.length) {
            const ideal = u.prevTpl || u.nextTpl;
            slot = free.reduce((best, r) => (Math.abs(r - ideal) < Math.abs(best - ideal) ? r : best), free[0]);
            if (Math.abs(slot - ideal) > 40)
              warnings.push(M.movedFar(name, String(cellInfo(ws.getCell(u.fileRow, 1)).value)));
          }
        }
        if (slot === undefined) {
          lost++;
          continue;
        }
        taken.add(slot);
        const o = (overrides[name] ??= {});
        const desc0 = cachedValue(ws.getCell(u.fileRow, 2));
        if (refKnown(ref)) {
          o[`A${slot}`] = typeof ref === "boolean" ? String(ref) : ref;
          const gInfo = cellInfo(ws.getCell(u.fileRow, 7));
          if (!gInfo.isFormula && typeof gInfo.value === "number") o[`G${slot}`] = gInfo.value;
        } else {
          // 가격 DB 에 없는 Ref (예: 손으로 적은 "Spare") — 그대로 넣으면 VLOOKUP 이 #N/A 가 된다.
          // 파일에 적혀 있던 품명과 단가를 그대로 옮겨 엑셀과 같은 금액이 나오게 한다.
          const g = cachedValue(ws.getCell(u.fileRow, 7));
          if (typeof desc0 === "string" && desc0.trim()) o[`B${slot}`] = desc0.trim().slice(0, 500);
          if (typeof g === "number") o[`G${slot}`] = g;
          warnings.push(M.refNotInDb(name, String(ref)));
        }
        if (qty !== null) o[`F${slot}`] = qty;
        if (yn) o[`D${slot}`] = yn;
        const desc = desc0;
        movedItems.push({
          sheet: name,
          ref: String(ref),
          description: typeof desc === "string" ? desc.slice(0, 70) : "",
          qty: qty ?? 1,
        });
        count += qty !== null ? 2 : 2;
        totalCells += 2;
        inserted++;
      }
      if (lost) warnings.push(M.lostItems(name, lost));
    }

    // ---------- 자리는 맞았지만 가격 DB 에 없는 Ref 도 같은 방식으로 바꾼다 ----------
    // Ref 하나가 어긋나면 그 줄의 VLOOKUP 이 #N/A 가 되고, 시트 합계와 최종가까지 전부 #N/A 가 된다.
    if (name !== "Total" && knownRefs && overrides[name]) {
      const o = overrides[name];
      // 템플릿에서 VLOOKUP(<칸>,Prices,…) 이 읽는 칸 목록
      const refCells = new Set<string>();
      for (const c of Object.values(tpl.cells)) {
        const m = /VLOOKUP\(\s*\$?([A-Z]{1,3})\$?(\d+)\s*,\s*Prices\b/i.exec(c.f ?? "");
        if (m) refCells.add(`${m[1]}${m[2]}`);
      }
      const fileRowOf = new Map<number, number>();
      for (const [fr, tr] of map) fileRowOf.set(tr, fr);
      for (const coord of Object.keys(o)) {
        if (!refCells.has(coord)) continue;
        if (refKnown(o[coord])) continue;
        const row = Number(coord.replace(/^[A-Z]+/, ""));
        const fileRow = fileRowOf.get(row);
        warnings.push(M.refNotInDb(name, String(o[coord])));
        delete o[coord];
        if (fileRow === undefined) continue;
        const desc = cachedValue(ws.getCell(fileRow, 2));
        const g = cachedValue(ws.getCell(fileRow, 7));
        if (typeof desc === "string" && desc.trim()) o[`B${row}`] = desc.trim().slice(0, 500);
        if (typeof g === "number") o[`G${row}`] = g;
      }
    }

    // ---------- 파일에서 삭제된 행 = 견적에서 뺀 품목 → 수량 0 ----------
    if (name !== "Total" && map.size > 2) {
      const qtyCol = (() => {
        try {
          return buildLayout(name, tpl).roles.qty ?? 0;
        } catch {
          return 0;
        }
      })();
      if (qtyCol) {
        const L = String.fromCharCode(64 + qtyCol);
        const mappedTpl = new Set(map.values());
        const first = Math.min(...mappedTpl);
        const last = Math.max(...mappedTpl);
        let zeroed = 0;
        for (let r = first; r <= last; r++) {
          if (mappedTpl.has(r)) continue;
          const q = tpl.cells[`${L}${r}`];
          if (!q || q.f !== undefined || typeof q.v !== "number" || q.v === 0) continue;
          (overrides[name] ??= {})[`${L}${r}`] = 0;
          zeroed++;
          count++;
          totalCells++;
        }
        if (zeroed) removedRows += zeroed;
      }
    }

    if (count) perSheet.push({ sheet: name, cells: count, alignedRows: matched, skippedRows: skipped, insertedRows: inserted });
  }

  if (totalCells >= MAX_CELLS) warnings.push(M.tooManyCells(MAX_CELLS));
  if (removedRows) warnings.push(M.removedRows(removedRows));
  if (unknownSheets.length) warnings.push(M.unknownSheets(unknownSheets.join(", ")));

  // ---------- 프로젝트 정보 ----------
  // 템플릿에서 자리표시자 문구가 들어 있는 셀이 곧 입력 칸이다 (B1, E1). 비어 있으면 아래 행도 확인.
  const pick = (coords: string[], placeholder: RegExp) => {
    for (const c of coords) {
      const v = cellInfo(totalWs.getCell(c)).value;
      if (typeof v === "string" && v.trim() && !placeholder.test(v)) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return "";
  };
  const meta = {
    title: pick(["B1", "B2", "C1"], /country\s*-\s*customer/i),
    quotation: pick(["E1", "E2", "F1"], /quotation-?no/i),
    editor: pick(["I1", "H2", "I2"], /^editor/i),
  };

  // ---------- 선택된 챔버 (파일 기준으로 읽어 이름으로 표시) ----------
  const chambers: { row: number; name: string; qty: number }[] = [];
  const totalMap = buildRowMap(totalWs, template.sheets["Total"], true).map;
  for (const [fileRow, tplRow] of totalMap) {
    if (tplRow < 9 || tplRow > 60 || fileRow <= headerRow) continue;
    const qtyRaw = cellInfo(totalWs.getCell(fileRow, 3)).value;
    const qty = typeof qtyRaw === "number" ? qtyRaw : 0;
    if (qty <= 0) continue;
    const nm = cellInfo(totalWs.getCell(fileRow, 2)).value;
    chambers.push({ row: tplRow, name: typeof nm === "string" ? nm.trim() : `Row ${tplRow}`, qty });
  }
  chambers.sort((a, b) => a.row - b.row);

  // 파일에 저장돼 있던 최종가 — 템플릿 AE66 에 대응하는 파일 행에서 읽는다
  const finalRow = [...totalMap.entries()].find(([, tj]) => tj === 66)?.[0];
  const fpv = finalRow ? cachedValue(totalWs.getCell(finalRow, 31)) : null; // AE = 31
  const fileFinalPrice = typeof fpv === "number" ? fpv : null;

  const revisionMismatch = !!fileRevision && fileRevision.toLowerCase() !== templateRevision.toLowerCase();
  if (revisionMismatch)
    warnings.push(M.revisionMismatch(fileRevision, templateRevision));
  if (!chambers.length) warnings.push(M.noChambers);

  return {
    fileRevision,
    templateRevision,
    revisionMismatch,
    meta,
    chambers,
    perSheet: perSheet.sort((a, b) => b.cells - a.cells),
    movedItems,
    totalCells,
    fileFinalPrice,
    unknownSheets,
    warnings,
    overrides,
  };
}

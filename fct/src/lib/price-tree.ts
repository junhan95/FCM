/**
 * 가격 DB(Prices resume 시트)를 "카테고리 → 하위 그룹 → 품목" 트리로 정리한다.
 *
 * 엑셀 원본은 한 품목의 설명이 여러 행에 걸쳐 있고, 구획 제목도 같은 열에 섞여 있다.
 *   · 카테고리 제목  : Ref 없음 + Item 이 "12 - Absorbers" 형태
 *   · 하위 그룹 제목 : Ref 없음 + Item 만 있고 설명·단위·단가가 모두 비어 있음
 *   · 이어지는 설명  : Ref 없음 + Item 비어 있고 Description 만 있음 → 바로 위 품목에 붙인다
 *   · 품목          : Ref 가 있거나, Ref 가 없어도 단위·단가가 있는 행
 */

export interface PriceRowView {
  id: number;
  row: number;
  ref: number | string | null;
  sage: string;
  item: string;
  description: string;
  unit: string;
  price: number | null;
  priceText: string;
  delivery: string;
  priceDate: string;
  category: string;
  isHeader: boolean;
}

/** 품목 한 건 = 대표 행 + 아래에 딸린 설명 행들 */
export interface PriceEntry {
  main: PriceRowView;
  extra: PriceRowView[];
}

export interface PriceGroup {
  key: string;
  name: string;
  entries: PriceEntry[];
}

export interface PriceCategory {
  key: string;
  no: string;
  name: string;
  groups: PriceGroup[];
  /** 품목 수 (설명 행 제외) */
  count: number;
  minRow: number;
  maxRow: number;
}

const CATEGORY_RE = /^\s*(\d+)\s*[-–—]\s*(.+?)\s*$/;
/** 그룹 제목처럼 보이지만 실제로는 품목에 딸린 메모 */
const NOTE_RE = /^\s*(ref\s*[:.]|art\.?\s*(no)?\s*[:.]|[\w.]+\s+part\s*[:#]|last\s+modification)/i;

const blank = (s: string) => s.trim() === "";

export function buildPriceTree(rows: PriceRowView[]): PriceCategory[] {
  const cats: PriceCategory[] = [];
  let catIdx = -1;
  let group: PriceGroup | null = null;
  const cur = () => cats[catIdx];

  const startCategory = (no: string, name: string, row: number) => {
    cats.push({ key: `${no}|${name}|${row}`, no, name, groups: [], count: 0, minRow: row, maxRow: row });
    catIdx = cats.length - 1;
    group = null;
  };
  /** 이름이 같은 그룹이 같은 카테고리에 이미 있으면 합친다 (엑셀에서 여러 번 반복되는 제목) */
  const intoGroup = (name: string): PriceGroup => {
    if (catIdx < 0) startCategory("", name || "—", 0);
    const c = cur();
    const found = c.groups.find((g) => g.name === name);
    if (found) return (group = found);
    const g: PriceGroup = { key: `${c.key}|${c.groups.length}`, name, entries: [] };
    c.groups.push(g);
    return (group = g);
  };

  // 시트 맨 위의 열 제목 행 등, 첫 카테고리 제목보다 앞선 행은 버린다
  const first = rows.findIndex((r) => r.isHeader && CATEGORY_RE.test(r.item));
  const body = first > 0 ? rows.slice(first) : rows;

  for (const r of body) {
    const hasItem = !blank(r.item);
    const hasDesc = !blank(r.description);
    const hasValue = !blank(r.unit) || r.price !== null;
    const m = hasItem ? CATEGORY_RE.exec(r.item) : null;

    // 1) 카테고리 제목
    if (r.isHeader && m && !hasValue) {
      startCategory(m[1], m[2], r.row);
      continue;
    }
    // 2) 하위 그룹 제목
    if (r.isHeader && hasItem && !hasDesc && !hasValue && !NOTE_RE.test(r.item)) {
      intoGroup(r.item.trim());
      continue;
    }
    // 3) 이어지는 설명 / 메모 — 바로 위 품목에 붙인다
    if (r.isHeader && !hasValue && (hasDesc || hasItem)) {
      const g = group ?? intoGroup("");
      const last = g.entries[g.entries.length - 1];
      if (last) {
        last.extra.push(r);
        cur().maxRow = Math.max(cur().maxRow, r.row);
        continue;
      }
      // 위에 품목이 없으면 그룹 제목으로 승격
      intoGroup((hasItem ? r.item : r.description).trim());
      continue;
    }
    // 4) 완전히 빈 행은 버린다
    if (r.isHeader && !hasItem && !hasDesc && !hasValue) continue;

    // 5) 품목
    const g = group ?? intoGroup("");
    g.entries.push({ main: r, extra: [] });
    const c = cur();
    c.count++;
    c.minRow = Math.min(c.minRow || r.row, r.row);
    c.maxRow = Math.max(c.maxRow, r.row);
  }

  // 품목이 하나도 없는 그룹/카테고리는 버린다
  for (const c of cats) c.groups = c.groups.filter((g) => g.entries.length);
  return cats.filter((c) => c.groups.length);
}

/** 검색어가 품목(설명 행 포함)에 걸리는지 */
export function entryMatches(e: PriceEntry, q: string): boolean {
  if (!q) return true;
  const hit = (r: PriceRowView) =>
    String(r.ref ?? "").toLowerCase().includes(q) ||
    r.sage.toLowerCase().includes(q) ||
    r.item.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q);
  return hit(e.main) || e.extra.some(hit);
}

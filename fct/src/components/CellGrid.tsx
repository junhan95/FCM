"use client";

import React, { useMemo } from "react";
import { useProject } from "./ProjectStore";
import { AutoCell, CellEditor } from "./cells";
import { coordOf, numToCol } from "@/engine/layout";
import { parseCoord } from "@/engine/parser";
import { PRICES_SHEET } from "@/engine/types";
import { fmtValue } from "@/lib/format";

/** 시트의 데이터 유효성(드롭다운) → coord 별 옵션 목록 */
export function useValidations(sheet: string) {
  const { wb } = useProject();
  return useMemo(() => {
    const map = new Map<string, string[]>();
    const s = wb?.template.sheets[sheet];
    if (!wb || !s?.validations) return map;
    for (const v of s.validations) {
      if (v.type !== "list") continue;
      const opts = listOptions(wb, v.formula1);
      for (const part of v.sqref.split(/\s+/)) {
        if (part.includes(":")) {
          const [a, b] = part.split(":");
          const p1 = parseCoord(a), p2 = parseCoord(b);
          for (let c = p1.col; c <= p2.col; c++) for (let r = p1.row; r <= p2.row; r++) map.set(coordOf(c, r), opts);
        } else map.set(part, opts);
      }
    }
    return map;
  }, [wb, sheet]);
}

/** 이름 정의(예: Supervisor = 'Prices resume'!$C$5:$C$17) → 옵션 문자열 배열 */
export function listOptions(wb: NonNullable<ReturnType<typeof useProject>["wb"]>, nameOrRange: string): string[] {
  const text = wb.template.names[nameOrRange] ?? nameOrRange;
  const m = /^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(text);
  if (!m) return [];
  const sheet = m[1];
  const c1 = parseCoord(m[2] + m[3]);
  const c2 = parseCoord(m[4] + m[5]);
  const out: string[] = [];
  for (let r = c1.row; r <= c2.row; r++) {
    const v = wb.get(sheet === PRICES_SHEET ? PRICES_SHEET : sheet, coordOf(c1.col, r));
    if (v !== null && v !== undefined && v !== "") out.push(String(v));
  }
  return out;
}

/**
 * 시트의 사각형 영역을 표 형태로 렌더 (옵션 블록·조건 블록 등 비정형 영역용)
 * - 리터럴 숫자 / Y-N → 입력, 수식 → 계산값, 문자열 → 라벨 (editableTextCols 에 포함된 열은 텍스트 입력)
 */
export default function CellGrid({
  sheet,
  r1,
  r2,
  c1,
  c2,
  editableTextCols = [],
  hideEmptyCols = true,
  showRowNo = true,
  extraSelects = {},
}: {
  sheet: string;
  r1: number;
  r2: number;
  c1: number;
  c2: number;
  editableTextCols?: number[];
  hideEmptyCols?: boolean;
  showRowNo?: boolean;
  /** 데이터 유효성 외에 추가로 드롭다운을 붙일 셀 (coord → 이름정의 또는 옵션 배열) */
  extraSelects?: Record<string, string | string[]>;
}) {
  const { wb } = useProject();
  const baseValidations = useValidations(sheet);
  const extraKey = JSON.stringify(extraSelects);
  const validations = useMemo(() => {
    const m = new Map(baseValidations);
    const extra = JSON.parse(extraKey) as Record<string, string | string[]>;
    for (const [coord, v] of Object.entries(extra)) m.set(coord, Array.isArray(v) ? v : listOptions(wb!, v));
    return m;
  }, [baseValidations, wb, extraKey]);
  const tpl = wb!.template.sheets[sheet];
  const cols: number[] = [];
  for (let c = c1; c <= c2; c++) {
    if (!hideEmptyCols) {
      cols.push(c);
      continue;
    }
    let has = editableTextCols.includes(c);
    for (let r = r1; r <= r2 && !has; r++) {
      const k = coordOf(c, r);
      if (tpl.cells[k] || wb!.isOverridden(sheet, k) || validations.has(k)) has = true;
    }
    if (has) cols.push(c);
  }
  const rows: number[] = [];
  for (let r = r1; r <= r2; r++) {
    let has = false;
    for (const c of cols) if (tpl.cells[coordOf(c, r)]) has = true;
    if (has) rows.push(r);
  }
  return (
    <div className="overflow-x-auto">
      <table className="tbl w-full">
        <thead>
          <tr>
            {showRowNo && <th className="w-8"></th>}
            {cols.map((c) => (
              <th key={c} className="text-center font-mono text-[10px] text-slate-400">
                {numToCol(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              {showRowNo && <td className="font-mono text-[10px] text-slate-400">{r}</td>}
              {cols.map((c) => {
                const coord = coordOf(c, r);
                const cell = tpl.cells[coord];
                const opts = validations.get(coord);
                const textEditable = editableTextCols.includes(c);
                if (opts && (!cell || cell.f === undefined))
                  return (
                    <td key={c}>
                      <CellEditor sheet={sheet} coord={coord} kind="select" options={opts} className="w-full min-w-[10rem]" />
                    </td>
                  );
                if (!cell && !textEditable) return <td key={c}></td>;
                const isLabel = cell && cell.f === undefined && typeof cell.v === "string" && !/^[YN]$/i.test(cell.v.trim()) && !textEditable;
                return (
                  <td key={c} className={isLabel ? "whitespace-pre-wrap text-slate-700" : "text-right"}>
                    {isLabel ? fmtValue(cell!.v) : <AutoCell sheet={sheet} coord={coord} textEditable={textEditable} />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

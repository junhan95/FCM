"use client";

import { useState } from "react";
import { useProject } from "../ProjectStore";
import { Calc, CellEditor } from "../cells";
import { fmtValue } from "@/lib/format";
import { ExcelError } from "@/engine/types";
import { listOptions } from "../CellGrid";
import { OPTION_SECTIONS, OptCol, OptSection, T, chamberRowOf, optionRows } from "@/lib/options";

const isBlank = (v: unknown) => v === null || v === undefined || v === "" || v === "-";

/** 한 칸 — 템플릿이 수식이면 계산값, 리터럴이면 입력칸 */
function OptCell({ col, row, caption }: { col: OptCol; row: number; caption?: boolean }) {
  const { wb, version } = useProject();
  void version;
  const coord = `${col.col}${row}`;
  const tc = wb!.templateCell(T, coord);
  const value = wb!.get(T, coord);
  const cls = `${col.align === "left" ? "!text-left " : ""}${col.wrap ? "whitespace-normal leading-snug " : ""}`.trim();
  // #N/A 는 "아직 고르지 않았다" 는 뜻이라 빨간 오류 대신 — 로 보여 준다
  const pending = value instanceof ExcelError && value.code === "#N/A";

  // 셀 자체가 없는 자리는 비워 둔다
  if (!tc && col.kind !== "eur" && col.kind !== "usd") return <td />;
  // 안내 열은 글이 길어 줄바꿈해서 그대로 보여 준다
  if (col.readOnly)
    return (
      <td className={`!text-left whitespace-normal py-1.5 leading-snug ${col.muted ? "text-[11px] text-slate-500" : "text-[12px] text-slate-700"}`}>
        {fmtValue(value, fmtOf(col.kind))}
      </td>
    );
  if (tc?.f)
    return (
      <td className={cls}>
        {pending ? <span className="cell-calc text-slate-300">—</span> : <Calc value={value} fmt={fmtOf(col.kind)} className={cls} />}
      </td>
    );

  // 엑셀에서 머리글 글자가 섞여 들어간 줄 — 숫자 열의 문자열은 비운다
  if (tc && typeof tc.v === "string" && col.kind !== "text" && col.kind !== "yn") {
    if (caption) return <td />;
    return <td className="text-[11px] text-slate-400">{tc.v}</td>;
  }

  if (col.kind === "yn") {
    return (
      <td>
        <CellEditor sheet={T} coord={coord} kind="yn" className="w-full" />
      </td>
    );
  }
  if (col.kind === "text") {
    return (
      <td className="!text-left">
        <CellEditor sheet={T} coord={coord} kind="text" className="w-full" />
      </td>
    );
  }
  return (
    <td>
      <CellEditor sheet={T} coord={coord} kind="num" fmt={fmtOf(col.kind)} step={col.step ? 1 : undefined} className="w-full" />
    </td>
  );
}

/** #N/A 는 아직 고르지 않았다는 뜻이라 — 로 보여 준다 */
function PendingCalc({ coord, fmt }: { coord: string; fmt?: string }) {
  const { wb, version } = useProject();
  void version;
  const v = wb!.get(T, coord);
  if (v instanceof ExcelError && v.code === "#N/A") return <span className="cell-calc text-slate-300">—</span>;
  return <Calc value={v} fmt={fmt} />;
}

function fmtOf(kind: OptCol["kind"]): string | undefined {
  switch (kind) {
    case "eur":
      return "eur";
    case "usd":
      return "usd";
    case "pct":
      return "pct";
    case "int":
      return "int";
    case "d2":
      return "d2";
    default:
      return undefined;
  }
}

/** 섹션 머리의 설정값 (Factor · Supervisor …) */
function NumericSelect({ coord, options }: { coord: string; options: string[] }) {
  const { wb, setCell, canEdit, version } = useProject();
  void version;
  const cur = wb!.get(T, coord);
  if (!canEdit) return <span className="cell-calc">{String(cur ?? "")}</span>;
  return (
    <select className="field w-full" value={cur === null || cur === undefined ? "" : String(cur)} onChange={(e) => setCell(T, coord, Number(e.target.value))}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function OptSettings({ section }: { section: OptSection }) {
  const { wb, t, version } = useProject();
  void version;
  if (!section.settings.length) return null;
  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-slate-100 px-4 py-3">
      {section.settings.map((s) => {
        const opts = s.list ? listOptions(wb!, s.list) : s.options;
        const missing = s.required && isBlank(wb!.get(T, s.coord));
        return (
          <label key={s.coord} className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">{s.label}</span>
            <span className="block w-56">
              {s.numeric && s.options ? (
                <NumericSelect coord={s.coord} options={s.options} />
              ) : opts && opts.length ? (
                <CellEditor sheet={T} coord={s.coord} kind="select" options={opts} className="w-full" />
              ) : s.kind === "pct" ? (
                <CellEditor sheet={T} coord={s.coord} kind="pct" fmt="pct" className="w-full" />
              ) : s.kind === "d2" ? (
                <CellEditor sheet={T} coord={s.coord} kind="num" fmt="d2" className="w-full" />
              ) : (
                <CellEditor sheet={T} coord={s.coord} kind="text" className="w-full" />
              )}
            </span>
            {missing && <span className="mt-0.5 block text-[10px] text-amber-700">{t("optPickFirst")}</span>}
          </label>
        );
      })}
    </div>
  );
}

function OptSectionCard({ section }: { section: OptSection }) {
  const { wb, t, version } = useProject();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  void version;

  const tpl = wb!.template.sheets[T];
  const rows = optionRows(tpl, section);
  const byChamber = section.filterable ? chamberRowOf(tpl, rows) : new Map<number, number>();
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

  /** 견적에 담긴 챔버 줄만 (또는 이미 수량이 들어간 줄) */
  const visible = rows.filter((r) => {
    if (showAll || !section.filterable) return true;
    if (num(wb!.get(T, `C${r}`)) > 0) return true;
    const src = byChamber.get(r);
    if (src === undefined) return true;
    return num(wb!.get(T, `C${src}`)) > 0;
  });

  /** 이 섹션에서 뭔가 고른 게 있는지 */
  const picked = rows.filter((r) => num(wb!.get(T, `C${r}`)) > 0).length;

  const colCount = section.cols.length;

  return (
    <section className="card overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
        <span className="text-[15px] text-slate-400">{open ? "▾" : "▸"}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{section.no}</span>
        <span className="text-[14px] font-semibold text-slate-800">{section.title}</span>
        {picked > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-brand">{picked}</span>}
        <span className="ml-auto text-[12px] text-slate-400">{visible.length}/{rows.length}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {section.settings.some((x) => x.required && isBlank(wb!.get(T, x.coord))) && (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">{t("optBlocked")}</div>
          )}
          <OptSettings section={section} />

          {section.filterable && (
            <label className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] text-slate-600">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              {t("optShowAll")}
            </label>
          )}

          <div className="overflow-x-auto">
            <table className="tbl tbl-fixed w-full" style={{ minWidth: 1120 }}>
              <colgroup>
                {section.cols.map((c) => (
                  <col key={c.col} style={{ width: c.width }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {section.cols.map((c) => (
                    <th key={c.col} className={c.align === "left" ? "!text-left" : ""}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r}>
                    {section.cols.map((c) => (
                      <OptCell key={c.col} col={c} row={r} caption={section.captionRows?.includes(r)} />
                    ))}
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={colCount} className="py-4 text-center text-[12px] text-slate-400">
                      {t("optNoRows")}
                    </td>
                  </tr>
                )}

                {section.subtotal && (
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                    <td colSpan={colCount - 2} className="!text-left text-[12px] text-slate-700">
                      {section.subtotal.label}
                    </td>
                    <td>
                      <PendingCalc coord={section.subtotal.coord} fmt="eur" />
                    </td>
                    <td />
                  </tr>
                )}
                {section.sum && (
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                    <td colSpan={colCount - 4} className="!text-left text-[12px] text-slate-700">
                      {section.sum.label}
                    </td>
                    <td>
                      <Calc value={wb!.get(T, section.sum.coord)} fmt="eur" />
                    </td>
                    <td />
                    <td />
                    <td>{section.sum.adj && <CellEditor sheet={T} coord={section.sum.adj} kind="num" fmt="eur" className="w-full" />}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {section.extras?.length ? (
            <div className="space-y-1.5 border-t border-slate-100 px-4 py-3">
              {section.extras.map((e) => (
                <div key={e.pick} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[300px] text-[12px] text-slate-600">{e.label}</span>
                  <span className="block w-64">
                    <CellEditor sheet={T} coord={e.pick} kind="select" options={listOptions(wb!, e.list)} className="w-full" />
                  </span>
                  <span className="ml-auto text-[13px] font-semibold tabular-nums text-slate-700">
                    <PendingCalc coord={e.value} fmt="eur" />
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {section.total && (
            <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-[13px] font-semibold text-slate-700">{section.total.label}</span>
              {section.total.coords.map((c) => (
                <span key={c.coord} className="text-[15px] font-bold tabular-nums text-slate-900">
                  <PendingCalc coord={c.coord} fmt={fmtOf(c.kind)} />
                </span>
              ))}
              {section.total.order && (
                <label className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
                  {t("optOrder")}
                  <span className="block w-16">
                    <CellEditor sheet={T} coord={section.total.order} kind="yn" className="w-full" />
                  </span>
                </label>
              )}
              {section.total.adj && (
                <label className="flex items-center gap-2 text-[11px] text-slate-500">
                  {t("optAdjPrice")}
                  <span className="block w-32">
                    <CellEditor sheet={T} coord={section.total.adj} kind="num" fmt="eur" className="w-full" />
                  </span>
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** 5단계 OPTIONS — 본 견적과 별도로 제시하는 선택 항목 */
export default function StepOptions() {
  const { wb, t, ready } = useProject();
  if (!wb || !ready) return null;
  return (
    <div className="space-y-4">
      <section className="card border-l-4 border-l-brand p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="card-title">{t("stepOptions")}</h2>
          <span className="card-sub">{t("optHint")}</span>
        </div>
      </section>
      {OPTION_SECTIONS.map((s) => (
        <OptSectionCard key={s.id} section={s} />
      ))}
    </div>
  );
}

"use client";

import { useProject } from "../ProjectStore";
import { CellEditor } from "../cells";
import { fmtNum } from "@/lib/format";
import { findDimCells } from "@/lib/wizard";

/**
 * 챔버 · 부속실 치수 입력 카드.
 * 3단계(구성품)에서 선택한 시트 목록 가장 위에 노출된다.
 * CR / AR / CR-AR Combi / SR 시트에도 동일하게 적용된다.
 */
export default function ChamberDimensions({ sheet, title }: { sheet: string; title: string }) {
  const { wb, t, version } = useProject();
  void version;

  if (!wb) return null;
  const tpl = wb.template.sheets[sheet];
  if (!tpl) return null;

  const dims = findDimCells(tpl);
  if (!dims.length && !dims.raisedFloor) return null;

  const fields = [
    { label: t("dimLength"), coord: dims.length },
    { label: t("dimWidth"), coord: dims.width },
    { label: t("dimHeight"), coord: dims.height },
    { label: t("dimRaisedFloor"), coord: dims.raisedFloor },
  ].filter((f): f is { label: string; coord: string } => !!f.coord);

  return (
    <section className="card border-l-4 border-l-brand p-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-3">
        <h2 className="card-title">
          {t("chamberDims")} — <span className="text-brand">{title}</span>
        </h2>
        <span className="card-sub">{t("dimHint")}</span>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        {fields.map((d) => (
          <label key={d.coord} className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">{d.label}</span>
            <span className="block w-28">
              <CellEditor sheet={sheet} coord={d.coord} kind="num" fmt="d3" className="w-full" />
            </span>
          </label>
        ))}
        {dims.totalShielding && (
          <div className="ml-2 rounded bg-slate-50 px-3 py-2">
            <div className="text-[11px] text-slate-500">{t("dimShielding")}</div>
            <div className="text-[14px] font-bold tabular-nums text-slate-800">{fmtNum(wb.get(sheet, dims.totalShielding), 2)} m²</div>
          </div>
        )}
      </div>
    </section>
  );
}

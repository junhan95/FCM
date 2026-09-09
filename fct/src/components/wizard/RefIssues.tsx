"use client";

import { useState } from "react";
import { useProject } from "../ProjectStore";
import { findBadRefs } from "@/lib/ref-check";

/**
 * 가격 DB 에서 찾을 수 없는 제품 번호가 있으면 알려 준다.
 * 그런 줄이 하나만 있어도 시트 합계부터 최종가까지 전부 #N/A 가 되기 때문에,
 * 원인이 된 칸을 짚어 주고 바로 비울 수 있게 한다.
 */
export default function RefIssues() {
  const { wb, t, setCell, canEdit, version, ready } = useProject();
  const [open, setOpen] = useState(false);
  void version;

  if (!wb || !ready) return null;
  const bad = findBadRefs(wb);
  if (!bad.length) return null;

  return (
    <section className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left">
        <span className="text-[13px]">⚠</span>
        <span className="text-[12px] font-semibold text-amber-900">
          {t("refIssueTitle")} ({bad.length})
        </span>
        <span className="text-[11px] text-amber-800">{t("refIssueHint")}</span>
        <span className="ml-auto text-[12px] text-amber-700">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-1 border-t border-amber-200 pt-2">
          {bad.map((b) => (
            <div key={`${b.sheet}!${b.coord}`} className="flex flex-wrap items-center gap-2 text-[12px] text-amber-900">
              <span className="rounded bg-white px-1.5 py-0.5 font-medium">{b.sheet}</span>
              <span className="text-amber-700">
                {b.coord} = <b>{String(b.value)}</b>
              </span>
              {b.qty !== null && (
                <span className="text-[11px] text-amber-700">
                  {t("fgQty")} {b.qty}
                </span>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="ml-auto rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:border-brand hover:text-brand"
                  onClick={() => {
                    setCell(b.sheet, b.coord, undefined);
                    if (b.qtyCoord) setCell(b.sheet, b.qtyCoord, undefined);
                  }}
                >
                  {t("refIssueClear")}
                </button>
              )}
            </div>
          ))}
          <p className="pt-1 text-[11px] text-amber-800">{t("refIssueNote")}</p>
        </div>
      )}
    </section>
  );
}

"use client";

import { useProject } from "../ProjectStore";
import { CellEditor } from "../cells";
import { fmtValue } from "@/lib/format";
import { CONDITION_GROUPS, CondField, INCOTERMS } from "@/lib/conditions";

const T = "Total";

/**
 * 견적 조건 (엑셀 Total 시트 T74:AH113).
 * 4단계에서는 입력, 5단계에서는 읽기 전용으로 같은 구조를 보여 준다.
 */
export default function ConditionsCard({ readOnly = false }: { readOnly?: boolean }) {
  const { wb, t, version } = useProject();
  void version;
  if (!wb) return null;

  const txt = (coord?: string) => (coord ? String(wb.get(T, coord) ?? "").trim() : "");

  return (
    <section className="card panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <h2 className="card-title text-brand">{t("conditionsTitle")}</h2>
        {!readOnly && <span className="card-sub">{t("conditionsHint")}</span>}
      </div>

      <div className="space-y-3">
        {CONDITION_GROUPS.map((g, gi) => (
          <div key={g.title ?? `g${gi}`}>
            {g.title && <h3 className="mb-1 border-b border-slate-200 pb-0.5 text-[12px] font-bold text-slate-700">{txt(g.title)}</h3>}
            <table className="w-full text-[12px]">
              <tbody>
                {g.rows.map((f) => (
                  <Row key={f.value} f={f} readOnly={readOnly} txt={txt} />
                ))}
              </tbody>
            </table>
            {g.title === "T110" && !readOnly && <p className="mt-0.5 text-[11px] text-slate-400">{INCOTERMS.join(" · ")}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

/** 템플릿의 자리표시자("included/ not included" 등)가 그대로 남아 있으면 아직 안 고른 칸이다 */
function isUnset(wb: NonNullable<ReturnType<typeof useProject>["wb"]>, coord: string) {
  const tplCell = wb.templateCell(T, coord);
  const tpl = tplCell?.f === undefined ? tplCell?.v : undefined;
  if (typeof tpl !== "string") return false;
  if (!/\/|\.\.\./.test(tpl)) return false;
  return String(wb.get(T, coord) ?? "") === tpl;
}

function Row({ f, readOnly, txt }: { f: CondField; readOnly: boolean; txt: (c?: string) => string }) {
  const { wb, t } = useProject();
  const unset = f.kind !== "pct" && isUnset(wb!, f.value);
  const shown = (coord: string, kind: CondField["kind"]) => {
    const v = wb!.get(T, coord);
    if (kind === "pct") return typeof v === "number" ? fmtValue(v, "pct") : fmtValue(v);
    return fmtValue(v);
  };

  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className="w-[132px] py-1 pr-2 align-top text-right text-slate-500">{txt(f.label)}</td>
      <td className="w-[210px] py-1 align-top">
        {readOnly ? (
          <span className={`block ${f.kind === "pct" ? "text-right tabular-nums" : ""} ${unset ? "text-amber-700" : "font-medium text-slate-800"}`}>
            {unset ? t("conditionUnset") : shown(f.value, f.kind)}
          </span>
        ) : (
          <span className={`flex items-center gap-1 ${unset ? "rounded ring-1 ring-amber-300" : ""}`} title={unset ? t("conditionUnset") : undefined}>
            <CellEditor
              sheet={T}
              coord={f.value}
              kind={f.kind === "select" ? "select" : f.kind === "pct" ? "pct" : "text"}
              options={f.options}
              className="w-full"
            />
          </span>
        )}
      </td>
      <td className="py-1 pl-2 align-top text-slate-700">
        {f.labelRight &&
          (readOnly ? (
            <span className="italic text-slate-600">{txt(f.labelRight)}</span>
          ) : (
            <CellEditor sheet={T} coord={f.labelRight} kind="text" className="w-full" />
          ))}
        {f.extra &&
          (readOnly ? (
            <span className="tabular-nums text-slate-700">{shown(f.extra.value, f.extra.kind)}</span>
          ) : (
            <span className="inline-flex w-28 items-center">
              <CellEditor sheet={T} coord={f.extra.value} kind="pct" className="w-full" />
            </span>
          ))}
      </td>
      <td className="w-[210px] py-1 pl-2 align-top text-[11px] text-slate-400">
        {f.note &&
          (readOnly ? (
            txt(f.note)
          ) : (
            <CellEditor sheet={T} coord={f.note} kind="text" className="w-full" />
          ))}
      </td>
    </tr>
  );
}

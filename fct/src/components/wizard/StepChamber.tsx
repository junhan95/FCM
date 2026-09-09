"use client";

import { useProject } from "../ProjectStore";
import { CellEditor } from "../cells";
import { fmtEur } from "@/lib/format";
import { CHAMBER_GROUP_LABEL, ChamberGroup, EXTRA_ROWS, MAIN_CHAMBER_ROWS, ROOM_ROWS, chamberGroup } from "@/lib/wizard";
import { chamberInfo } from "@/lib/chamber-info";
import ChamberCard from "./ChamberCard";

const T = "Total";

/** Total!E{row} 수식에서 참조 시트명 추출 */
function sourceSheet(f?: string): string | null {
  if (!f) return null;
  const m = /^'([^']+)'!|^([A-Za-z][A-Za-z0-9\- ]*?)!/.exec(f);
  return m ? (m[1] ?? m[2]) : null;
}

const GROUPS: ChamberGroup[] = ["compact", "fac", "sac", "sac10", "vehicle", "special"];

export default function StepChamber({ onNext }: { onNext: () => void }) {
  const { wb, t, lang, setCell, version, canEdit } = useProject();
  void version;

  if (!wb) return null;

  // 워크북은 제자리에서 갱신되므로 매 렌더 계산한다 (행 40개 — 비용 무시 가능)
  const tplTotal = wb.template.sheets[T].cells;
  const rows = MAIN_CHAMBER_ROWS.map((r) => {
    const qty = wb.get(T, `C${r}`);
    return {
      row: r,
      name: String(wb.get(T, `B${r}`) ?? "").trim(),
      sheet: sourceSheet(tplTotal[`E${r}`]?.f),
      cost: wb.get(T, `E${r}`),
      qty: typeof qty === "number" ? qty : 0,
      group: chamberGroup(String(wb.get(T, `B${r}`) ?? ""), r),
    };
  }).filter((x) => x.name);

  const selected = rows.filter((x) => x.qty > 0);
  const available = rows.filter((x) => x.qty <= 0);

  return (
    <div className="space-y-5">
      {/* 선택된 챔버 목록 + 추가 */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-3">
          <h2 className="card-title">{t("selectChamber")}</h2>
          <span className="card-sub">{t("selectChamberHint")}</span>
        </div>

        {selected.length === 0 ? (
          <p className="mb-3 rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-[13px] text-slate-500">
            {t("noChamberYet")}
          </p>
        ) : (
          <table className="tbl mb-3 w-full">
            <thead>
              <tr>
                <th className="min-w-[200px]">{t("chamberType")}</th>
                <th className="w-24 text-right">{t("qty")}</th>
                <th className="w-32 text-right">{t("materialCost")}</th>
                <th className="w-32 text-right">{t("materialSales")}</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {selected.map((c) => (
                <tr key={c.row} className="bg-red-50/40">
                  <td className="text-[13px] font-semibold text-slate-900">{c.name}</td>
                  <td>
                    <CellEditor sheet={T} coord={`C${c.row}`} kind="num" step={1} className="w-full justify-end" />
                  </td>
                  <td className="text-right tabular-nums text-slate-600">{fmtEur(c.cost)}</td>
                  <td className="text-right font-semibold tabular-nums text-slate-800">{fmtEur(wb.get(T, `F${c.row}`))}</td>
                  <td className="text-right">
                    {canEdit && (
                    <button
                      type="button"
                      title={t("removeChamber")}
                      onClick={() => setCell(T, `C${c.row}`, 0)}
                      className="rounded px-1.5 py-0.5 text-[14px] leading-none text-slate-300 hover:bg-red-50 hover:text-brand"
                    >
                      ✕
                    </button>
                    )}
                  </td>
                </tr>
              ))}
              {selected.length > 1 && (
                <tr className="total">
                  <td colSpan={3}>Σ</td>
                  <td className="text-right">{fmtEur(wb.get(T, "F55"))}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <div className={`flex flex-wrap items-end gap-3 ${canEdit ? "" : "hidden"}`}>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">{selected.length ? t("addChamber") : t("chamberType")}</span>
            <select
              className="field w-[420px] !py-2 text-[14px]"
              value=""
              onChange={(e) => {
                if (e.target.value) setCell(T, `C${Number(e.target.value)}`, 1);
              }}
            >
              <option value="">— {t("addChamberHint")} —</option>
              {GROUPS.map((gk) => {
                const list = available.filter((x) => x.group === gk);
                if (!list.length) return null;
                return (
                  <optgroup key={gk} label={lang === "ko" ? CHAMBER_GROUP_LABEL[gk].ko : CHAMBER_GROUP_LABEL[gk].en}>
                    {list.map((c) => (
                      <option key={c.row} value={c.row}>
                        {c.name}
                        {typeof c.cost === "number" && c.cost > 0 ? `  —  ${fmtEur(c.cost)}` : ""}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
          {selected.length > 0 && (
            <button type="button" className="btn mb-0.5" onClick={onNext}>
              {t("stepParts")} →
            </button>
          )}
        </div>
      </section>

      {/* 선택한 챔버 소개 (썸네일 + 사양) */}
      {selected.some((c) => chamberInfo(c.row)) && (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline gap-3">
            <h2 className="card-title">{t("chamberInfoTitle")}</h2>
            <span className="card-sub">{t("chamberInfoHint")}</span>
          </div>
          <div className="space-y-3">
            {selected.map((c) => (
              <ChamberCard key={c.row} row={c.row} name={c.name} qty={c.qty} />
            ))}
          </div>
        </section>
      )}

      {/* 부속실 / 추가 항목 */}
      <div className="space-y-4">
        <RowQtyList rows={ROOM_ROWS} title={t("addRooms")} hint={t("addRoomsHint")} />
        <RowQtyList rows={EXTRA_ROWS} title={t("addExtras")} hint={t("addExtrasHint")} />
      </div>
    </div>
  );
}

function RowQtyList({ rows, title, hint }: { rows: number[]; title: string; hint: string }) {
  const { wb, t } = useProject();
  if (!wb) return null;
  return (
    <section className="card panel p-4">
      <h2 className="card-title">{title}</h2>
      <p className="mb-2 text-[12px] text-slate-500">{hint}</p>
      <table className="tbl tbl-fixed w-full">
        <colgroup>
          <col />
          <col style={{ width: "120px" }} />
          <col style={{ width: "140px" }} />
        </colgroup>
        <tbody>
          {rows.map((r) => {
            const name = String(wb.get(T, `B${r}`) ?? "").trim();
            if (!name) return null;
            const qty = wb.get(T, `C${r}`);
            const on = typeof qty === "number" && qty > 0;
            return (
              <tr key={r} className={on ? "bg-red-50/40" : ""}>
                <td className={`text-[13px] ${on ? "font-semibold text-slate-900" : "text-slate-700"}`}>{name}</td>
                <td>
                  <CellEditor sheet={T} coord={`C${r}`} kind="num" step={1} className="w-full" />
                </td>
                <td className="text-right text-[12px] tabular-nums text-slate-600">{on ? fmtEur(wb.get(T, `F${r}`)) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-slate-400">{t("materialSales")}</p>
    </section>
  );
}

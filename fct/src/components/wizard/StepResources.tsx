"use client";

import { useMemo, useState } from "react";
import { useProject } from "../ProjectStore";
import { Calc, CellEditor } from "../cells";
import { listOptions } from "../CellGrid";
import { fmtEur, fmtValue } from "@/lib/format";
import { REGIONS, matchOption } from "@/lib/regions";
import { EXTRA_ROWS, MAIN_CHAMBER_ROWS, ROOM_ROWS } from "@/lib/wizard";
import ConditionsCard from "./ConditionsCard";

const T = "Total";

export default function StepResources({ hasChamber }: { hasChamber: boolean }) {
  const { wb, t, lang, setCell, version } = useProject();
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  void version;

  const lists = useMemo(() => {
    if (!wb) return null;
    return {
      supervisor: listOptions(wb, "Supervisor"),
      manpower: listOptions(wb, "Manpower"),
      travel: listOptions(wb, "Travel_cost"),
      transport: listOptions(wb, "Type_of_transportation"),
    };
  }, [wb]);

  if (!wb || !lists) return null;
  const g = (c: string) => wb.get(T, c);

  const applyRegion = (code: string) => {
    const r = REGIONS.find((x) => x.code === code);
    if (!r) return;
    const sv = matchOption(lists.supervisor, r.sv);
    const wk = matchOption(lists.manpower, r.worker);
    const tv = matchOption(lists.travel, r.travel);
    const tp = matchOption(lists.transport, r.transport);
    if (sv) setCell(T, "L7", sv);
    if (wk) {
      setCell(T, "O7", wk);
      setCell(T, "R7", wk);
    }
    if (tv) setCell(T, "T7", tv);
    if (tp) setCell(T, "X6", tp);
    setAppliedCode(code);
  };

  // 현재 설정과 일치하는 프리셋 찾기 (표시용)
  const currentSv = String(g("L7") ?? "");
  const currentTravel = String(g("T7") ?? "");
  const guessed = REGIONS.find(
    (r) => matchOption(lists.supervisor, r.sv) === currentSv && matchOption(lists.travel, r.travel) === currentTravel,
  );

  // 견적에 포함된 행 (인력·컨테이너 입력 대상)
  const activeRows = [...MAIN_CHAMBER_ROWS, ...ROOM_ROWS, ...EXTRA_ROWS].filter((r) => {
    const v = g(`C${r}`);
    return typeof v === "number" && v > 0;
  });

  return (
    <div className="space-y-4">
      {/* 국가 선택 */}
      <section className="card p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <h2 className="card-title">{t("installCountry")}</h2>
          <span className="card-sub">{t("installCountryHint")}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {REGIONS.map((r) => {
            const active = appliedCode ? appliedCode === r.code : guessed?.code === r.code;
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => applyRegion(r.code)}
                className={`rounded-md border-2 px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                  active ? "border-brand bg-red-50 font-semibold text-brand" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {lang === "ko" ? r.ko : r.en}
                {lang === "ko" && <span className="block text-[10px] font-normal text-slate-400">{r.en}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <div className="space-y-4">
        {/* 자동 설정된 값 (수정 가능) */}
        <section className="card panel p-4">
          <h2 className="card-title mb-3">{t("globalSettings")}</h2>
          <Field label={t("svType")} coord="L7" options={lists.supervisor} />
          <Field label={t("workerType")} coord="O7" options={lists.manpower} />
          <Field label={t("extraWorkerType")} coord="R7" options={lists.manpower} />
          <Field label={t("travelRegion")} coord="T7" options={lists.travel} />
          <Field label={t("transportType")} coord="X6" options={lists.transport} />
          <Field label={t("surchargeSv")} coord="H4" fmt="eur" />
          <Field label={t("transportCn")} coord="AA8" fmt="eur" />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded bg-slate-50 p-2 text-[11px] text-slate-500">
            <div>
              SV/day <b className="text-slate-700">{fmtEur(g("L8"))}</b>
            </div>
            <div>
              Worker/day <b className="text-slate-700">{fmtEur(g("O8"))}</b>
            </div>
            <div>
              Travel/person <b className="text-slate-700">{fmtEur(g("T8"))}</b>
            </div>
            <div>
              Travel days <b className="text-slate-700">{fmtValue(g("K5"))}</b>
            </div>
            <div>
              40ft cont. PL <b className="text-slate-700">{fmtEur(g("Y8"))}</b>
            </div>
          </div>

          <h2 className="eyebrow mb-1.5 mt-5 block border-t border-slate-100 pt-3">{t("currencySection")}</h2>
          <Field label={t("fxUsd")} coord="E68" />
          <Field label={t("fxRmb")} coord="E69" />
          <Field label={t("fxInr")} coord="E70" />
          <Field label={t("ferriteDiscount")} coord="J67" fmt="pct" />
          <Field label={t("bidBond")} coord="AD67" fmt="pct" />
          <Field label={t("ddp")} coord="AG70" kind="yn" />
          <Field label={t("importTax")} coord="AF70" fmt="pct" />
        </section>

        {/* 인력 · 컨테이너 */}
        <section className="card p-4">
          <div className="mb-2 flex flex-wrap items-baseline gap-3">
            <h2 className="card-title">{t("manpower")}</h2>
            <span className="card-sub">{t("manpowerHint")}</span>
          </div>
          {activeRows.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-500">{t("noChamberYet")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl w-full text-[12px]">
                <thead>
                  <tr>
                    <th className="min-w-[160px]">{t("chamberType")}</th>
                    <th className="w-[72px] text-right">{t("factorMaterial")}</th>
                    <th className="w-28 text-right">{t("materialSales")}</th>
                    <th className="w-[68px] text-right">{t("cycles")}</th>
                    <th className="w-[68px] text-right">{t("svQty")}</th>
                    <th className="w-16 text-right">{t("svDays")}</th>
                    <th className="w-[68px] text-right">{t("workerQty")}</th>
                    <th className="w-16 text-right">{t("workerDays")}</th>
                    <th className="w-[68px] text-right">{t("extraQty")}</th>
                    <th className="w-16 text-right">{t("extraDays")}</th>
                    <th className="w-[72px] text-right">{t("factorInstall")}</th>
                    <th className="w-24 text-right">{t("installSales")}</th>
                    <th className="w-[68px] text-right">{t("contPl")}</th>
                    <th className="w-[68px] text-right">{t("contCn")}</th>
                    <th className="w-24 text-right">{t("transport")}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((r) => (
                    <tr key={r}>
                      <td className="font-medium text-slate-800">{fmtValue(g(`B${r}`))}</td>
                      <td>
                        <CellEditor sheet={T} coord={`D${r}`} kind="num" fmt="d2" className="w-full justify-end" />
                      </td>
                      <td className="text-right">
                        <Calc value={g(`F${r}`)} fmt="eur" />
                      </td>
                      <td>
                        <Num coord={`I${r}`} />
                      </td>
                      <td>
                        <Num coord={`J${r}`} />
                      </td>
                      <td>
                        <Num coord={`K${r}`} fmt="d1" />
                      </td>
                      <td>
                        <Num coord={`M${r}`} />
                      </td>
                      <td>
                        <Num coord={`N${r}`} fmt="d1" />
                      </td>
                      <td>
                        <Num coord={`P${r}`} />
                      </td>
                      <td>
                        <Num coord={`Q${r}`} fmt="d1" />
                      </td>
                      <td>
                        <CellEditor sheet={T} coord={`H${r}`} kind="num" fmt="d2" className="w-full justify-end" />
                      </td>
                      <td className="text-right">
                        <Calc value={g(`V${r}`)} fmt="eur" />
                      </td>
                      <td>
                        <Num coord={`X${r}`} />
                      </td>
                      <td>
                        <Num coord={`Z${r}`} />
                      </td>
                      <td className="text-right">
                        <Calc
                          value={typeof g(`Y${r}`) === "number" && typeof g(`AA${r}`) === "number" ? (g(`Y${r}`) as number) + (g(`AA${r}`) as number) : g(`Y${r}`)}
                          fmt="eur"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan={2}>Σ</td>
                    <td className="text-right">
                      <Calc value={g("F64")} fmt="eur" />
                    </td>
                    <td colSpan={8}></td>
                    <td className="text-right">
                      <Calc value={g("V64")} fmt="eur" />
                    </td>
                    <td className="text-right">{fmtValue(g("X64"))}</td>
                    <td className="text-right">{fmtValue(g("Z64"))}</td>
                    <td className="text-right">
                      <Calc
                        value={typeof g("Y64") === "number" && typeof g("AA64") === "number" ? (g("Y64") as number) + (g("AA64") as number) : g("Y64")}
                        fmt="eur"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            <b className="text-slate-600">{t("factorMaterial")}</b> — {t("factorMaterialHint")}
            <br />
            <b className="text-slate-600">{t("factorInstall")}</b> — {t("factorInstallHint")}
          </p>
          {hasChamber && <p className="mt-1 text-[11px] text-slate-400">{t("legend")}</p>}
        </section>

        {/* 견적 조건 */}
        <ConditionsCard />
      </div>
    </div>
  );
}

/** 인원·일수·컨테이너 등 세는 값 — 일수는 0.5 단위로 조절한다 */
function Num({ coord, fmt }: { coord: string; fmt?: string }) {
  return <CellEditor sheet={T} coord={coord} kind="num" fmt={fmt} step={fmt === "d1" ? 0.5 : 1} className="w-full justify-end" />;
}

function Field({ label, coord, options, fmt, kind }: { label: string; coord: string; options?: string[]; fmt?: string; kind?: "num" | "yn" }) {
  return (
    <label className="flex items-center justify-between gap-2 border-b border-slate-100 py-1 text-[12px]">
      <span className="text-slate-600">{label}</span>
      <span className="w-52">
        <CellEditor sheet={T} coord={coord} kind={options ? "select" : (kind ?? "num")} options={options} fmt={fmt} className="w-full justify-end" />
      </span>
    </label>
  );
}

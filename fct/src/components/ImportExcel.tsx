"use client";

import { useRef, useState } from "react";
import { Lang, makeT } from "@/lib/i18n";
import { createProjectFromImportAction } from "@/app/actions/projects";
import type { Overrides } from "@/engine/types";
import { fmtEur } from "@/lib/format";

interface Preview {
  fileName: string;
  fileRevision: string | null;
  templateRevision: string;
  revisionMismatch: boolean;
  meta: { title: string; quotation: string; editor: string };
  chambers: { row: number; name: string; qty: number }[];
  perSheet: { sheet: string; cells: number; insertedRows: number }[];
  totalCells: number;
  fileFinalPrice: number | null;
  recalculated: number | null;
  movedItems: { sheet: string; ref: string; description: string; qty: number }[];
  unknownSheets: string[];
  warnings: string[];
  overrides: Overrides;
}

export default function ImportExcel({ lang, defaultEditor }: { lang: Lang; defaultEditor: string }) {
  const t = makeT(lang);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [name, setName] = useState("");
  const [customer, setCustomer] = useState("");
  const [country, setCountry] = useState("");
  const [quotationNo, setQuotationNo] = useState("");
  const [dragOver, setDragOver] = useState(false);
  void defaultEditor;

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `${t("importError")} (${res.status})`);
        return;
      }
      const p = data as Preview;
      setPreview(p);
      // "국가 - 고객사 - 프로젝트" 형태면 나눠 채운다.
      // 공백 없는 하이픈(프로젝트 번호 6301-0826-TB…)은 나누지 않는다.
      const title = p.meta.title.trim();
      const parts = title.split(/\s+[-–—]\s+/).filter(Boolean);
      const wordy = (x: string) => /[A-Za-z가-힣]/.test(x) && !/^\d+$/.test(x);
      if (parts.length >= 3 && wordy(parts[0]) && wordy(parts[1])) {
        setCountry(parts[0]);
        setCustomer(parts[1]);
        setName(parts.slice(2).join(" - "));
      } else if (parts.length === 2 && wordy(parts[0])) {
        setCustomer(parts[0]);
        setName(parts[1]);
      } else {
        setName(title || file.name.replace(/\.xlsx$/i, ""));
        setCustomer("");
        setCountry("");
      }
      setQuotationNo(p.meta.quotation);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="card p-4">
      <h2 className="card-title">{t("importExcel")}</h2>
      <p className="mb-3 text-[12px] text-slate-500">{t("importExcelHint")}</p>

      {!preview && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void upload(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver ? "border-brand bg-red-50" : "border-slate-300 bg-slate-50 hover:border-brand"
            }`}
          >
            <span className="text-[20px] text-slate-400">⬆</span>
            <span className="text-[13px] font-medium text-slate-700">{busy ? t("importReading") : t("importDrop")}</span>
            <span className="text-[11px] text-slate-400">.xlsx</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </>
      )}

      {error && (
        <div className="mt-3 rounded bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
          <button type="button" className="ml-2 underline" onClick={reset}>
            {t("importRetry")}
          </button>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-[12px]">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-semibold text-slate-800">{preview.fileName}</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500">{preview.fileRevision ?? "?"}</span>
              <button type="button" className="ml-auto text-slate-500 underline hover:text-brand" onClick={reset}>
                {t("importOther")}
              </button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-slate-600">
              <span>
                {t("importCells")}: <b className="text-slate-900">{preview.totalCells.toLocaleString()}</b>
              </span>
              <span>
                {t("importSheets")}: <b className="text-slate-900">{preview.perSheet.length}</b>
              </span>
            </div>
            {preview.chambers.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {preview.chambers.map((c) => (
                  <span key={c.row} className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-brand">
                    {c.name}
                    {c.qty !== 1 ? ` ×${c.qty}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 금액 대조 */}
          {(preview.fileFinalPrice !== null || preview.recalculated !== null) && (
            <div className="rounded border border-slate-200 p-3 text-[12px]">
              <div className="mb-1 font-semibold text-slate-700">{t("importCompare")}</div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">{t("importFilePrice")}</span>
                <b className="tabular-nums text-slate-800">{preview.fileFinalPrice !== null ? fmtEur(preview.fileFinalPrice) : "—"}</b>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">{t("importRecalc")}</span>
                <b className="tabular-nums text-brand">{preview.recalculated !== null ? fmtEur(preview.recalculated) : "—"}</b>
              </div>
              {preview.fileFinalPrice !== null && preview.recalculated !== null && (
                <div className="mt-1 border-t border-slate-100 pt-1">
                  {(() => {
                    const d = preview.recalculated - preview.fileFinalPrice;
                    const pct = preview.fileFinalPrice ? (d / preview.fileFinalPrice) * 100 : 0;
                    const ok = Math.abs(pct) < 0.5;
                    return (
                      <div className={`flex justify-between ${ok ? "text-emerald-700" : "text-amber-700"}`}>
                        <span>{t("importDiff")}</span>
                        <b className="tabular-nums">
                          {d >= 0 ? "+" : ""}
                          {fmtEur(d)} ({pct >= 0 ? "+" : ""}
                          {pct.toFixed(2)}%)
                        </b>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {preview.movedItems.length > 0 && (
            <details className="rounded bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
              <summary className="cursor-pointer font-semibold">
                {t("importMoved")} ({preview.movedItems.length})
              </summary>
              <ul className="mt-1 space-y-0.5">
                {preview.movedItems.map((m, i) => (
                  <li key={i}>
                    · [{m.sheet.trim()}] {m.ref} {m.description} × {m.qty}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {preview.warnings.length > 0 && (
            <ul className="space-y-0.5 rounded bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              {preview.warnings.map((w, i) => (
                <li key={i}>· {w}</li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <label className="block text-[12px]">
              <span className="text-slate-600">{t("projectName")} *</span>
              <input className="field mt-0.5" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[12px]">
                <span className="text-slate-600">{t("customer")}</span>
                <input className="field mt-0.5" value={customer} onChange={(e) => setCustomer(e.target.value)} />
              </label>
              <label className="block text-[12px]">
                <span className="text-slate-600">{t("country")}</span>
                <input className="field mt-0.5" value={country} onChange={(e) => setCountry(e.target.value)} />
              </label>
            </div>
            <label className="block text-[12px]">
              <span className="text-slate-600">{t("quotationNo")}</span>
              <input className="field mt-0.5" value={quotationNo} onChange={(e) => setQuotationNo(e.target.value)} />
            </label>
          </div>

          <button
            type="button"
            className="btn w-full justify-center"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              await createProjectFromImportAction({
                name: name.trim(),
                customer,
                country,
                quotationNo,
                overrides: preview.overrides,
              });
              setBusy(false);
            }}
          >
            {busy ? t("importCreating") : t("importCreate")}
          </button>
        </div>
      )}
    </section>
  );
}

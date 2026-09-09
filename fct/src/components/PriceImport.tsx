"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lang, makeT } from "@/lib/i18n";
import type { PriceChangeRecord, PriceImportRecord } from "@/lib/data";

interface Preview {
  fileName: string;
  version: string | null;
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
  total: number;
  currentTotal: number;
  samples: { row: number; ref: string; item: string; before: string; after: string }[];
  warnings: string[];
}

const KIND_STYLE: Record<string, string> = {
  added: "bg-emerald-50 text-emerald-700",
  price: "bg-amber-50 text-amber-700",
  text: "bg-slate-100 text-slate-600",
  removed: "bg-red-50 text-red-700",
};

const eur = (v: number | null) => (v === null || v === undefined ? "—" : `€ ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

/**
 * 가격 DB 업데이트 — 엑셀 파일로 한꺼번에 갱신하고, 무엇이 바뀌었는지 보여 준다.
 */
export default function PriceImport({
  lang,
  last,
  changes,
  history,
  itemCount,
}: {
  lang: Lang;
  last: PriceImportRecord | null;
  changes: PriceChangeRecord[];
  history: PriceImportRecord[];
  itemCount: number;
}) {
  const t = makeT(lang);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"added" | "price" | "removed">("added");
  const [dragOver, setDragOver] = useState(false);

  const send = async (file: File, apply: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (apply) fd.append("apply", "1");
      const res = await fetch("/api/admin/prices/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `오류 (${res.status})`);
        return null;
      }
      return data;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file: File) => {
    fileRef.current = file;
    setPreview(null);
    const data = await send(file, false);
    if (data) setPreview(data as Preview);
  };

  const apply = async () => {
    const f = fileRef.current;
    if (!f) return;
    const data = await send(f, true);
    if (data) {
      setPreview(null);
      fileRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
      setOpen(true);
      router.refresh();
    }
  };

  const counts = {
    added: changes.filter((c) => c.kind === "added").length,
    price: changes.filter((c) => c.kind === "price" || c.kind === "text").length,
    removed: changes.filter((c) => c.kind === "removed").length,
  };
  const list = changes.filter((c) => (tab === "price" ? c.kind === "price" || c.kind === "text" : c.kind === tab));

  return (
    <section className="card mb-4 overflow-hidden">
      {/* 최종 업데이트 정보 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-slate-100 px-4 py-3">
        <span className="text-[14px] font-semibold text-slate-800">{t("priceUpdate")}</span>
        <span className="text-[12px] text-slate-500">
          {t("priceUpdatedAt")}:{" "}
          <b className="text-slate-800">{last ? new Date(last.uploaded_at).toLocaleString() : "—"}</b>
        </span>
        <span className="text-[12px] text-slate-500">
          {t("priceVersion")}: <b className="text-slate-800">{last?.version ?? "—"}</b>
        </span>
        <span className="text-[12px] text-slate-500">
          {t("itemsCount")}: <b className="text-slate-800">{itemCount.toLocaleString()}</b>
        </span>
        {last?.username && <span className="text-[12px] text-slate-400">{last.username}</span>}
        {last && (
          <button type="button" className="btn-secondary ml-auto !py-1 !text-[12px]" onClick={() => setOpen(!open)}>
            {open ? t("priceHideChanges") : t("priceShowChanges")} ({last.added + last.changed + last.removed})
          </button>
        )}
      </div>

      {/* 업로드 */}
      <div className="px-4 py-3">
        {!preview ? (
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
                if (f) void pick(f);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-center transition-colors ${
                dragOver ? "border-brand bg-red-50" : "border-slate-300 bg-slate-50 hover:border-brand"
              }`}
            >
              <span className="text-[16px] text-slate-400">⬆</span>
              <span className="text-[13px] font-medium text-slate-700">{busy ? t("priceReading") : t("priceDrop")}</span>
              <span className="text-[11px] text-slate-400">.xlsx · Prices resume</span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pick(f);
              }}
            />
          </>
        ) : (
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px]">
              <b className="text-slate-800">{preview.fileName}</b>
              {preview.version && <span className="badge bg-slate-200 text-slate-600">{preview.version}</span>}
              <button
                type="button"
                className="ml-auto text-slate-500 underline hover:text-brand"
                onClick={() => {
                  setPreview(null);
                  fileRef.current = null;
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                {t("importOther")}
              </button>
            </div>
            <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
              <span className="text-emerald-700">
                {t("priceAdded")} <b>{preview.added}</b>
              </span>
              <span className="text-amber-700">
                {t("priceChanged")} <b>{preview.changed}</b>
              </span>
              <span className="text-red-700">
                {t("priceRemoved")} <b>{preview.removed}</b>
              </span>
              <span className="text-slate-500">
                {t("priceUnchanged")} <b>{preview.unchanged}</b>
              </span>
              <span className="ml-auto text-slate-500">
                {preview.currentTotal.toLocaleString()} → <b className="text-slate-800">{preview.total.toLocaleString()}</b>
              </span>
            </div>
            {preview.warnings.includes("MANY_REMOVED") && (
              <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">{t("priceManyRemoved")}</p>
            )}
            {preview.samples.length > 0 && (
              <div className="mb-2 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white">
                <table className="tbl w-full text-[11px]">
                  <tbody>
                    {preview.samples.map((s) => (
                      <tr key={s.row}>
                        <td className="w-16 text-slate-400">{s.ref}</td>
                        <td className="!text-left text-slate-700">{s.item}</td>
                        <td className="w-24 text-right text-slate-400">{s.before}</td>
                        <td className="w-6 text-center text-slate-300">→</td>
                        <td className="w-24 text-right font-semibold text-slate-800">{s.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" className="btn w-full justify-center" disabled={busy} onClick={() => void apply()}>
              {busy ? t("priceApplying") : t("priceApply")}
            </button>
          </div>
        )}
        {error && <div className="mt-2 rounded bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
      </div>

      {/* 이번 업데이트에서 바뀐 항목 */}
      {open && last && (
        <div className="border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2 px-4 py-2">
            {(["added", "price", "removed"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`chip !py-1 !text-[12px] ${tab === k ? "chip-on" : ""}`}
              >
                {k === "added" ? t("priceAdded") : k === "price" ? t("priceChanged") : t("priceRemoved")} {counts[k]}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-slate-400">{last.file_name}</span>
          </div>
          <div className="max-h-80 overflow-y-auto border-t border-slate-100">
            <table className="tbl w-full text-[12px]">
              <thead>
                <tr>
                  <th className="w-20">Ref</th>
                  <th className="!text-left">{t("item")}</th>
                  <th className="w-24 text-right">{t("priceBefore")}</th>
                  <th className="w-24 text-right">{t("priceAfter")}</th>
                  <th className="w-20 text-right">{t("priceDelta")}</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      {t("priceNoChanges")}
                    </td>
                  </tr>
                )}
                {list.map((c) => {
                  const pct =
                    c.kind === "price" && c.old_price && c.new_price !== null ? ((c.new_price - c.old_price) / c.old_price) * 100 : null;
                  return (
                    <tr key={`${c.kind}-${c.row}`}>
                      <td className="text-center">
                        <span className={`badge ${KIND_STYLE[c.kind]}`}>{c.ref || c.row}</span>
                      </td>
                      <td className="!text-left text-slate-700">{c.item || "—"}</td>
                      <td className="text-right tabular-nums text-slate-500">{eur(c.old_price)}</td>
                      <td className="text-right tabular-nums font-semibold text-slate-800">{eur(c.new_price)}</td>
                      <td className={`text-right tabular-nums ${pct === null ? "text-slate-300" : pct > 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {last.added + last.changed + last.removed > changes.length && (
            <p className="border-t border-slate-100 px-4 py-1.5 text-[11px] text-slate-400">
              {t("priceTruncated")} {changes.length.toLocaleString()}
            </p>
          )}

          {history.length > 1 && (
            <div className="border-t border-slate-100 px-4 py-2">
              <div className="mb-1 text-[11px] font-semibold text-slate-500">{t("priceHistory")}</div>
              <ul className="space-y-0.5 text-[11px] text-slate-500">
                {history.slice(1).map((h) => (
                  <li key={h.id}>
                    {new Date(h.uploaded_at).toLocaleString()} · {h.version ?? "—"} · {t("priceAdded")} {h.added} / {t("priceChanged")} {h.changed} /{" "}
                    {t("priceRemoved")} {h.removed} · {h.username ?? "—"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

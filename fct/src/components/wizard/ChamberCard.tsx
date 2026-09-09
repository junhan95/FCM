"use client";

import { useState } from "react";
import { CHAMBER_IMG, chamberInfo } from "@/lib/chamber-info";
import { useProject } from "../ProjectStore";

/**
 * 선택한 챔버의 썸네일 + 간단한 사양.
 * 자료는 frankonia-korea.com 모델 페이지(본사 2026 카탈로그 표기)에서 가져왔다.
 */
export default function ChamberCard({ row, name, qty }: { row: number; name: string; qty: number }) {
  const { t } = useProject();
  const [i, setI] = useState(0);
  const info = chamberInfo(row);
  if (!info) return null;

  const shots = info.shots;
  const cur = shots[i % shots.length];

  return (
    <article className="card flex gap-4 overflow-hidden p-3">
      {/* 사진 */}
      <div className="relative w-[220px] shrink-0 overflow-hidden rounded bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${CHAMBER_IMG}${cur}`} alt={info.model} className="h-full w-full object-cover" loading="lazy" />
        {shots.length > 1 && (
          <>
            <button
              type="button"
              aria-label="prev"
              onClick={() => setI((v) => (v - 1 + shots.length) % shots.length)}
              className="absolute left-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[12px] text-slate-600 shadow hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="next"
              onClick={() => setI((v) => (v + 1) % shots.length)}
              className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[12px] text-slate-600 shadow hover:bg-white"
            >
              ›
            </button>
            <span className="absolute bottom-1 right-1 rounded-full bg-white/85 px-1.5 text-[10px] text-slate-500">
              {(i % shots.length) + 1} / {shots.length}
            </span>
          </>
        )}
      </div>

      {/* 설명 */}
      <div className="min-w-0 flex-1 py-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="card-title text-brand">{name}</h3>
          {info.model !== name && <span className="text-[11px] text-slate-400">{info.model}</span>}
          {qty > 1 && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand">× {qty}</span>}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{info.desc}</p>
        <dl className="mt-2 space-y-0.5 text-[11px] text-slate-500">
          {info.size && (
            <div className="flex gap-2">
              <dt className="w-[86px] shrink-0 text-slate-400">{t("specSize")}</dt>
              <dd className="tabular-nums text-slate-700">{info.size}</dd>
            </div>
          )}
          {info.range && (
            <div className="flex gap-2">
              <dt className="w-[86px] shrink-0 text-slate-400">{t("specRange")}</dt>
              <dd className="text-slate-700">{info.range}</dd>
            </div>
          )}
          {info.note && (
            <div className="flex gap-2">
              <dt className="w-[86px] shrink-0 text-slate-400">{t("specNote")}</dt>
              <dd className="text-slate-700">{info.note}</dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  );
}

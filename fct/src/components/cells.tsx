"use client";

import React, { useState } from "react";
import { useProject } from "./ProjectStore";
import { fmtValue, parseInput } from "@/lib/format";
import { CellValue, ExcelError } from "@/engine/types";

export function Calc({ value, fmt, className = "" }: { value: CellValue | undefined; fmt?: string; className?: string }) {
  const err = value instanceof ExcelError;
  return <span className={`cell-calc ${err ? "cell-err" : ""} ${className}`}>{fmtValue(value, fmt)}</span>;
}

/**
 * 입력 가능 셀.
 * - 템플릿이 리터럴이면 항상 입력 가능
 * - 템플릿이 수식이면 계산값 표시 + (allowOverride 시) 클릭하여 수동 입력, 다시 초기화 가능
 */
export function CellEditor({
  sheet,
  coord,
  kind = "num",
  fmt,
  options,
  allowOverride = true,
  className = "",
  placeholder,
  step,
  min = 0,
}: {
  sheet: string;
  coord: string;
  kind?: "num" | "text" | "yn" | "select" | "pct";
  fmt?: string;
  options?: string[];
  allowOverride?: boolean;
  className?: string;
  placeholder?: string;
  /** 값을 정하면 수량 조절 화살표(▲▼)를 붙인다 — 한 번에 이만큼 더하고 뺀다 */
  step?: number;
  /** 화살표로 내려갈 수 있는 최솟값 (기본 0 — 수량은 음수가 될 수 없다) */
  min?: number;
}) {
  const { wb, setCell, t, canEdit } = useProject();
  // draft === null 이면 편집 중이 아님 (현재 입력값 표시)
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const tc = wb!.templateCell(sheet, coord);
  const isFormula = !!tc?.f;
  const overridden = wb!.isOverridden(sheet, coord);
  const value = wb!.get(sheet, coord);
  const input = wb!.inputValue(sheet, coord);
  const inputStr =
    input === null || input === undefined
      ? ""
      : kind === "pct" && typeof input === "number"
        ? String(Math.round(input * 1e6) / 1e4)
        : String(input);

  // 열람 전용 계정 — 입력 대신 값만 보여 준다
  if (!canEdit) {
    if (kind === "yn") {
      const cur = String(input ?? "").toUpperCase() === "Y" ? "Y" : "N";
      return (
        <span className={`inline-flex items-center ${className}`}>
          <span
            className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
              cur === "Y" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            {cur}
          </span>
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center ${className}`}>
        <Calc value={isFormula && !overridden ? value : (input ?? value)} fmt={kind === "pct" ? "pct" : fmt} className={kind === "text" ? "text-left" : ""} />
      </span>
    );
  }

  // 수식 셀 (덮어쓰기 안 된 상태)
  if (isFormula && !overridden && !editing) {
    return (
      <span className={`group inline-flex items-center justify-end gap-1 ${className}`}>
        <Calc value={value} fmt={fmt} />
        {allowOverride && (
          <button
            type="button"
            title={t("auto")}
            className="invisible rounded px-1 text-[10px] text-slate-400 hover:bg-slate-200 group-hover:visible"
            onClick={() => setDraft(typeof value === "number" ? String(value) : fmtValue(value))}
          >
            ✎
          </button>
        )}
      </span>
    );
  }

  const commit = (s: string) => {
    setDraft(null);
    // 백분율 칸은 "20" 또는 "20%" 를 0.2 로 저장한다 (엑셀이 비율로 갖고 있다)
    if (kind === "pct") {
      const t = s.replace("%", "").trim().replace(",", ".");
      if (t === "") {
        setCell(sheet, coord, undefined);
        return;
      }
      const n = Number(t);
      if (!Number.isFinite(n)) return;
      setCell(sheet, coord, n / 100);
      return;
    }
    const v = kind === "text" ? s : parseInput(s);
    if (v === "" && isFormula) {
      setCell(sheet, coord, undefined);
      return;
    }
    setCell(sheet, coord, v === "" ? undefined : v);
  };

  const resetBtn =
    overridden ? (
      <button
        type="button"
        title={t("overridden")}
        className="ml-0.5 rounded px-1 text-[10px] text-amber-600 hover:bg-amber-100"
        onClick={() => setCell(sheet, coord, undefined)}
      >
        ↺
      </button>
    ) : null;

  if (kind === "yn") {
    const cur = String(input ?? "").toUpperCase() === "Y" ? "Y" : "N";
    return (
      <span className={`inline-flex items-center ${className}`}>
        <button
          type="button"
          className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
            cur === "Y" ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-500"
          } ${overridden ? "ring-1 ring-amber-400" : ""}`}
          onClick={() => setCell(sheet, coord, cur === "Y" ? "N" : "Y")}
        >
          {cur}
        </button>
        {resetBtn}
      </span>
    );
  }

  if (kind === "select" && options) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <select
          className={`cell-input text ${overridden ? "overridden" : ""}`}
          value={String(input ?? "")}
          onChange={(e) => setCell(sheet, coord, e.target.value)}
        >
          {!options.includes(String(input ?? "")) && <option value={String(input ?? "")}>{String(input ?? "")}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {resetBtn}
      </span>
    );
  }

  // ▲▼ 로 수량을 더하고 뺀다. 편집 중이면 편집 중인 값을 기준으로 한다.
  const bump = (d: number) => {
    if (step === undefined) return;
    const base = Number(editing ? draft : inputStr);
    const cur = Number.isFinite(base) ? base : 0;
    const next = Math.max(min, Math.round((cur + d * step) * 1e6) / 1e6);
    setDraft(null);
    setCell(sheet, coord, next);
  };

  const field = (
    <input
      className={`cell-input ${kind === "text" ? "text" : ""} ${overridden ? "overridden" : ""} ${step !== undefined ? "pl-[18px]" : ""}`}
      value={editing ? draft : inputStr}
      placeholder={placeholder}
      autoFocus={editing && isFormula}
      onFocus={() => setDraft(inputStr)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        }
        if (step !== undefined && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          bump(e.key === "ArrowUp" ? 1 : -1);
        }
      }}
    />
  );

  return (
    <span className={`inline-flex items-center ${className}`}>
      {step === undefined ? (
        field
      ) : (
        <span className="relative inline-flex min-w-0 flex-1">
          {field}
          <span className="absolute inset-y-px left-px flex w-[16px] flex-col overflow-hidden rounded-l">
            <Spin dir="up" onClick={() => bump(1)} />
            <Spin dir="down" onClick={() => bump(-1)} disabled={Number(editing ? draft : inputStr) <= min} />
          </span>
        </span>
      )}
      {resetBtn}
    </span>
  );
}

/** 수량 증감 화살표 */
function Spin({ dir, onClick, disabled = false }: { dir: "up" | "down"; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={dir === "up" ? "+" : "-"}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center border-r border-sky-200 bg-sky-100/70 leading-none text-sky-700 transition-colors hover:bg-sky-300 disabled:text-sky-300 disabled:hover:bg-sky-100/70 ${
        dir === "up" ? "border-b" : ""
      }`}
    >
      <svg viewBox="0 0 8 5" className="h-[4px] w-[8px]" aria-hidden>
        <path d={dir === "up" ? "M0 5 L4 0 L8 5 Z" : "M0 0 L4 5 L8 0 Z"} fill="currentColor" />
      </svg>
    </button>
  );
}

/** 편집 가능 여부 판단 없이 셀을 자동으로 렌더: 리터럴 숫자/Y-N/문자열 → 입력, 수식 → 계산값 */
export function AutoCell({
  sheet,
  coord,
  textEditable = false,
  allowOverride = true,
  fmt,
}: {
  sheet: string;
  coord: string;
  textEditable?: boolean;
  allowOverride?: boolean;
  fmt?: string;
}) {
  const { wb } = useProject();
  const tc = wb!.templateCell(sheet, coord);
  const f = fmt ?? tc?.fmt;
  if (!tc) return textEditable ? <CellEditor sheet={sheet} coord={coord} kind="text" fmt={f} /> : null;
  if (tc.f) return <CellEditor sheet={sheet} coord={coord} kind="num" fmt={f} allowOverride={allowOverride} />;
  const v = tc.v;
  if (typeof v === "number") return <CellEditor sheet={sheet} coord={coord} kind="num" fmt={f} />;
  if (typeof v === "string" && /^[YN]$/i.test(v.trim())) return <CellEditor sheet={sheet} coord={coord} kind="yn" />;
  if (typeof v === "string" && textEditable) return <CellEditor sheet={sheet} coord={coord} kind="text" />;
  return <span className="whitespace-pre-wrap">{fmtValue(wb!.get(sheet, coord), f)}</span>;
}

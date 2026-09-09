"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Workbook } from "@/engine/workbook";
import { Overrides, PriceRow, Scalar, Template } from "@/engine/types";
import { buildLayout, SheetLayout } from "@/engine/layout";
import { Lang, makeT } from "@/lib/i18n";
import { FG_SHEET, syncFireGasTotal } from "@/lib/fire-gas";
import { ITEMS_SHEET, ensureItemsSheet, syncCustomTotal } from "@/lib/custom-items";

interface EngineData {
  templateId: number;
  version: string;
  template: Template;
  prices: PriceRow[];
}

// 모듈 레벨 캐시 (페이지 이동 시 재다운로드 방지)
const layoutCache = new Map<string, SheetLayout>();
let engineCache: { key: string; data: EngineData; etag: string | null } | null = null;

async function loadEngineData(templateId: number): Promise<EngineData> {
  const key = String(templateId);
  const headers: Record<string, string> = {};
  if (engineCache?.key === key && engineCache.etag) headers["If-None-Match"] = engineCache.etag;
  const res = await fetch(`/api/engine-data?template=${templateId}`, { headers, cache: "no-store" });
  if (res.status === 304 && engineCache?.key === key) return engineCache.data;
  if (!res.ok) throw new Error("engine data load failed: " + res.status);
  const data = (await res.json()) as EngineData;
  engineCache = { key, data, etag: res.headers.get("ETag") };
  return data;
}

export type SaveState = "saved" | "saving" | "unsaved" | "error";

interface StoreValue {
  ready: boolean;
  error: string | null;
  wb: Workbook | null;
  version: number;
  overrides: Overrides;
  setCell: (sheet: string, coord: string, value: Scalar | undefined) => void;
  /** 코드에서 직접 workbook 을 고친 뒤 화면 갱신과 저장을 예약한다 */
  touch: () => void;
  layout: (sheet: string) => SheetLayout;
  /** 가격 DB (구성품 추가 다이얼로그가 쓴다) */
  prices: PriceRow[];
  saveState: SaveState;
  saveNow: () => Promise<void>;
  projectId: number;
  lang: Lang;
  t: ReturnType<typeof makeT>;
  templateVersion: string;
  /** 값을 고칠 수 있는 계정인지 — false 면 입력이 모두 읽기 전용이 된다 */
  canEdit: boolean;
}

const Ctx = createContext<StoreValue | null>(null);

export function useProject(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("ProjectStore 밖에서 useProject 호출");
  return v;
}

export function ProjectStore({
  projectId,
  templateId,
  initialOverrides,
  lang,
  canEdit = true,
  children,
}: {
  projectId: number;
  templateId: number;
  initialOverrides: Overrides;
  lang: Lang;
  canEdit?: boolean;
  children: React.ReactNode;
}) {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [templateVersion, setTemplateVersion] = useState("");
  const overridesRef = useRef<Overrides>(structuredClone(initialOverrides));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useMemo(() => makeT(lang), [lang]);

  useEffect(() => {
    let alive = true;
    loadEngineData(templateId)
      .then((d) => {
        if (!alive) return;
        ensureItemsSheet(d.template); // 외부 견적 자유 입력용 예약 시트
        const w = new Workbook(d.template, d.prices, overridesRef.current);
        layoutCache.clear();
        setTemplateVersion(d.version);
        setPrices(d.prices);
        setWb(w);
        setVersion((v) => v + 1);
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [templateId]);

  const saveNow = useCallback(async () => {
    if (!canEdit) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setSaveState("saving");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: overridesRef.current }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [projectId, canEdit]);

  const setCell = useCallback(
    (sheet: string, coord: string, value: Scalar | undefined) => {
      if (!wb || !canEdit) return; // 열람 전용 — 아무것도 바꾸지 않는다
      // 템플릿 리터럴과 같은 값이면 override 제거
      const tc = wb.templateCell(sheet, coord);
      let v = value;
      if (v !== undefined && tc && tc.f === undefined && (tc.v ?? null) === v) v = undefined;
      if (v === "" ) v = undefined;
      wb.setOverride(sheet, coord, v);
      // Fire & Gas 시트는 Total!E58 로 이어 준다 (원본 엑셀의 참조가 빈 칸을 가리킨다)
      if (sheet === FG_SHEET) syncFireGasTotal(wb);
      // 자유 입력 품목은 템플릿 행이 없어 합계를 직접 Total 행에 넣어 준다
      if (sheet === ITEMS_SHEET) {
        const r = Number(String(coord).split("!")[0]);
        if (Number.isInteger(r)) syncCustomTotal(wb, r);
      }
      overridesRef.current = wb.overrides;
      setVersion((x) => x + 1);
      setSaveState("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveNow(), 900);
    },
    [wb, saveNow, canEdit],
  );

  const touch = useCallback(() => {
    if (!wb || !canEdit) return;
    overridesRef.current = wb.overrides;
    setVersion((x) => x + 1);
    setSaveState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow(), 900);
  }, [wb, saveNow, canEdit]);

  // 페이지 이탈 시 저장 경고
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (saveState === "unsaved" || saveState === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [saveState]);

  const layout = useCallback(
    (sheet: string) => {
      const key = templateId + "|" + sheet;
      let l = layoutCache.get(key);
      if (!l && wb) {
        l = buildLayout(sheet, wb.template.sheets[sheet]);
        layoutCache.set(key, l);
      }
      return l!;
    },
    [wb, templateId],
  );

  const value: StoreValue = {
    ready: !!wb,
    error,
    wb,
    version,
    overrides: wb?.overrides ?? initialOverrides,
    setCell,
    touch,
    layout,
    prices,
    saveState,
    saveNow,
    projectId,
    lang,
    t,
    templateVersion,
    canEdit,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

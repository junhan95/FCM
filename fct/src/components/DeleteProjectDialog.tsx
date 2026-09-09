"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProjectAction } from "@/app/actions/projects";
import { Lang, makeT } from "@/lib/i18n";

const HOLD_MS = 3000;

export function TrashIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-[15px] w-[15px] ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

/**
 * 프로젝트 삭제 — 실수로 지우는 것을 막기 위해
 *   1) 프로젝트명을 정확히 입력하고
 *   2) 삭제 버튼을 3초간 누르고 있어야
 * 삭제된다.
 */
export default function DeleteProjectDialog({
  projectId,
  projectName,
  lang,
  variant = "icon",
  afterDelete,
}: {
  projectId: number;
  projectName: string;
  lang: Lang;
  variant?: "icon" | "button";
  afterDelete?: string;
}) {
  const t = makeT(lang);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [progress, setProgress] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const raf = useRef<number | null>(null);
  const startedAt = useRef(0);

  const nameOk = typed.trim() === projectName.trim();

  const stopHold = useCallback(() => {
    if (raf.current === null) return;
    cancelAnimationFrame(raf.current);
    raf.current = null;
    setProgress(0);
  }, []);

  const doDelete = useCallback(async () => {
    stopHold();
    setDeleting(true);
    setError(null);
    try {
      await deleteProjectAction(projectId);
      if (afterDelete) router.push(afterDelete);
      else router.refresh();
      setOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  }, [projectId, afterDelete, router, stopHold]);

  const startHold = useCallback(() => {
    if (!nameOk || deleting) return;
    startedAt.current = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - startedAt.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        raf.current = null;
        void doDelete();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [nameOk, deleting, doDelete]);

  // 언마운트 시 애니메이션 정리
  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopHold();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, stopHold]);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          title={t("delete")}
          aria-label={t("delete")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setTyped("");
            stopHold();
            setOpen(true);
          }}
          className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-brand"
        >
          <TrashIcon />
        </button>
      ) : (
        <button
          type="button"
          className="btn-danger w-full justify-center"
          onClick={() => {
            setTyped("");
            stopHold();
            setOpen(true);
          }}
        >
          <TrashIcon /> {t("delete")}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => {
            stopHold();
            setOpen(false);
          }}
        >
          <div className="card w-[420px] p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">{t("deleteProject")}</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{t("deleteWarning")}</p>

            <div className="my-3 rounded bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-800">{projectName}</div>

            <label className="block text-[12px]">
              <span className="text-slate-600">{t("deleteTypeName")}</span>
              <input
                className={`field mt-0.5 ${typed && !nameOk ? "border-red-400" : ""}`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={projectName}
                autoFocus
                autoComplete="off"
              />
            </label>

            <button
              type="button"
              disabled={!nameOk || deleting}
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              className={`relative mt-3 w-full select-none overflow-hidden rounded px-3 py-2.5 text-[13px] font-semibold text-white transition-colors ${
                nameOk && !deleting ? "bg-brand-dark" : "cursor-not-allowed bg-slate-300"
              } ${progress > 0 ? "ring-2 ring-brand ring-offset-1" : ""}`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-white/35"
                style={{ width: `${progress * 100}%` }}
                aria-hidden
              />
              <span className="relative">
                {deleting ? t("deleting") : progress > 0 ? `${t("deleteHolding")} ${Math.ceil((1 - progress) * 3)}` : t("deleteHold")}
              </span>
            </button>

            {error && <p className="mt-2 text-[12px] text-red-700">{error}</p>}

            <button
              type="button"
              className="btn-secondary mt-2 w-full justify-center"
              onClick={() => {
                stopHold();
                setOpen(false);
              }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

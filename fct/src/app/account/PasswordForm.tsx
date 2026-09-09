"use client";

import { useActionState } from "react";
import { changePasswordAction } from "../actions/auth";

export default function PasswordForm({ labels }: { labels: { title: string; current: string; nw: string; save: string; ok: string } }) {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="card space-y-3 p-4">
      <h2 className="text-[13px] font-semibold">{labels.title}</h2>
      <input name="current" type="password" className="field" placeholder={labels.current} required autoComplete="current-password" />
      <input name="new" type="password" className="field" placeholder={labels.nw} required minLength={6} autoComplete="new-password" />
      {state?.error && <div className="text-[12px] text-red-700">{state.error === "wrong" ? "✗ " + labels.current : "✗ min 6"}</div>}
      {state?.ok && <div className="text-[12px] text-emerald-700">✓ {labels.ok}</div>}
      <button className="btn" disabled={pending}>
        {labels.save}
      </button>
    </form>
  );
}

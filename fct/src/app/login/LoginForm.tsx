"use client";

import { useActionState } from "react";
import { loginAction } from "../actions/auth";

export default function LoginForm({
  next,
  labels,
}: {
  next: string;
  labels: { username: string; password: string; login: string; failed: string };
}) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="mb-1 block text-[12px] font-medium text-slate-600">{labels.username}</label>
        <input name="username" className="field" autoComplete="username" autoFocus required />
      </div>
      <div>
        <label className="mb-1 block text-[12px] font-medium text-slate-600">{labels.password}</label>
        <input name="password" type="password" className="field" autoComplete="current-password" required />
      </div>
      {state?.error && <div className="rounded bg-red-50 px-3 py-2 text-[12px] text-red-700">{labels.failed}</div>}
      <button className="btn w-full justify-center" disabled={pending}>
        {labels.login}
      </button>
    </form>
  );
}

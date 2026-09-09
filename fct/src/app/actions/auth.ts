"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, createSessionToken, SESSION_COOKIE, getSession, hashPassword, checkPassword } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { audit } from "@/lib/data";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const user = await authenticate(username, password);
  if (!user) return { error: "invalid" };
  const token = await createSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "1",
  });
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  const s = await getSession();
  if (s) await audit(s.id, "LOGOUT");
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setLangAction(lang: string) {
  const store = await cookies();
  store.set("fct_lang", lang === "en" ? "en" : "ko", { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function changePasswordAction(_prev: { error?: string; ok?: boolean } | undefined, formData: FormData) {
  const s = await getSession();
  if (!s) redirect("/login");
  const cur = String(formData.get("current") ?? "");
  const nw = String(formData.get("new") ?? "");
  if (nw.length < 6) return { error: "short" };
  const u = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [s.id]);
  if (!u || !(await checkPassword(cur, u.password_hash))) return { error: "wrong" };
  await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [await hashPassword(nw), s.id]);
  await audit(s.id, "CHANGE_PASSWORD");
  return { ok: true };
}

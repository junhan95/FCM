import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { query, queryOne } from "./db";

export type Role = "ADMIN" | "USER";
export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: Role;
}

export const SESSION_COOKIE = "fct_session";
const SESSION_HOURS = 12;

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET 환경변수(16자 이상)를 .env 에 설정하세요");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.id !== "number") return null;
    return {
      id: payload.id as number,
      username: String(payload.username),
      name: String(payload.name ?? ""),
      role: (payload.role as Role) === "ADMIN" ? "ADMIN" : "USER",
    };
  } catch {
    return null;
  }
}

/** 현재 로그인 사용자 (없으면 null) */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await verifySessionToken(token);
  if (!s) return null;
  // 비활성화된 계정은 즉시 차단
  const u = await queryOne<{ active: boolean; role: Role; name: string }>(
    "SELECT active, role, name FROM users WHERE id = $1",
    [s.id],
  );
  if (!u || !u.active) return null;
  return { ...s, role: u.role, name: u.name };
}

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireAdmin(): Promise<SessionUser> {
  const s = await requireSession();
  if (s.role !== "ADMIN") redirect("/?denied=1");
  return s;
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function checkPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
  const u = await queryOne<{ id: number; username: string; name: string; role: Role; password_hash: string; active: boolean }>(
    "SELECT id, username, name, role, password_hash, active FROM users WHERE lower(username) = lower($1)",
    [username.trim()],
  );
  if (!u || !u.active) return null;
  const ok = await checkPassword(password, u.password_hash);
  if (!ok) return null;
  await query("INSERT INTO audit_log (user_id, action) VALUES ($1, 'LOGIN')", [u.id]);
  return { id: u.id, username: u.username, name: u.name, role: u.role };
}

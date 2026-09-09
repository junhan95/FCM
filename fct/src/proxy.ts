import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * 인증 게이트: 로그인 쿠키가 없거나 유효하지 않으면 모든 페이지를 /login 으로 보낸다.
 * (주소창에 경로를 직접 입력해도 로그인 없이는 접근 불가)
 */
const PUBLIC = ["/login", "/api/health"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  // The server-side getSession gate validates this token against FCM on every
  // request. Cookie presence here is only a routing optimization.
  if (process.env.FCM_BRIDGE_SECRET && request.cookies.has('fcm_session')) return NextResponse.next();

  const token = request.cookies.get("fct_session")?.value;
  let ok = false;
  if (token && process.env.SESSION_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET));
      ok = true;
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|css|js|map)$).*)"],
};

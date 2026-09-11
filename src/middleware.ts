import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, readSessionEdge } from "@/lib/authEdge";

/** 로그인 없이 열 수 있는 경로 */
const PUBLIC = ["/login", "/api/login", "/api/logout", "/api/setup-status", "/api/request"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await readSessionEdge(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  // 크루원이 아직 없을 때는 관리자 화면을 열어둡니다.
  // 첫 크루원이 등록되면 이 경로도 자동으로 잠깁니다.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/set-password")) {
    try {
      const res = await fetch(new URL("/api/setup-status", req.url));
      const { empty } = await res.json();
      if (empty) return NextResponse.next();
    } catch {
      /* 확인에 실패하면 안전하게 로그인 화면으로 보냅니다 */
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-.*\\.png|apple-touch-icon.png).*)",
  ],
};

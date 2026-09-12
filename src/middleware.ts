import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, readSessionEdge } from "@/lib/authEdge";

/** 로그인 없이 열 수 있는 경로 */
const PUBLIC = ["/login", "/api/login", "/api/logout", "/api/setup-status", "/api/request"];

/**
 * 크루원이 한 명도 없는 초기 상태인지 확인합니다.
 * 예전에는 내부 API를 한 번 더 호출했는데, 그러면 함수가 두 번 깨어나 느려서
 * Supabase 에 직접 물어보도록 바꿨습니다.
 */
async function crewIsEmpty(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  try {
    const res = await fetch(`${url}/rest/v1/crew_members?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) && rows.length === 0;
  } catch {
    // 확인에 실패하면 안전하게 잠급니다.
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await readSessionEdge(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  // 크루원이 아직 없을 때만 관리자 화면을 열어둡니다.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/set-password")) {
    if (await crewIsEmpty()) return NextResponse.next();
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

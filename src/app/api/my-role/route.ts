import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

/** 로그인한 사람의 직책을 알려줍니다. 운영장이면 관리자 PIN을 건너뜁니다. */
export async function GET(req: NextRequest) {
  const session = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ role: null });

  const { data } = await supabaseAdmin
    .from("crew_members")
    .select("role")
    .eq("id", session.id)
    .maybeSingle();

  return NextResponse.json({ role: data?.role ?? null });
}

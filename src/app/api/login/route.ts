import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPassword, createSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();

  if (!name?.trim() || !password) {
    return NextResponse.json({ error: "이름과 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const { data: member } = await supabaseAdmin
    .from("crew_members")
    .select("id, name, active")
    .eq("name", name.trim())
    .maybeSingle();

  // 어떤 이름이 존재하는지 알려주지 않기 위해 실패 메시지를 하나로 통일합니다.
  const fail = NextResponse.json({ error: "이름 또는 비밀번호가 맞지 않아요." }, { status: 401 });

  if (!member || !member.active) return fail;

  const { data: cred } = await supabaseAdmin
    .from("member_credentials")
    .select("password_hash")
    .eq("member_id", member.id)
    .maybeSingle();

  if (!cred) {
    return NextResponse.json(
      { error: "아직 비밀번호가 설정되지 않았어요. 운영자에게 요청해주세요." },
      { status: 401 }
    );
  }

  if (!verifyPassword(password, cred.password_hash)) return fail;

  const res = NextResponse.json({ ok: true, id: member.id, name: member.name });
  res.cookies.set(SESSION_COOKIE, createSession(member.id, member.name), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

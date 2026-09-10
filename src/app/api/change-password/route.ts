import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword, verifyPassword, readSession, SESSION_COOKIE } from "@/lib/auth";

/** 본인이 자기 비밀번호를 바꿉니다. 현재 비밀번호를 알아야만 바꿀 수 있어요. */
export async function POST(req: NextRequest) {
  const session = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "다시 로그인해주세요." }, { status: 401 });

  const { current, next } = await req.json();

  if (!next || String(next).length < 4) {
    return NextResponse.json({ error: "새 비밀번호는 4자 이상으로 정해주세요." }, { status: 400 });
  }

  const { data: cred } = await supabaseAdmin
    .from("member_credentials")
    .select("password_hash")
    .eq("member_id", session.id)
    .maybeSingle();

  if (!cred || !verifyPassword(String(current ?? ""), cred.password_hash)) {
    return NextResponse.json({ error: "지금 쓰는 비밀번호가 맞지 않아요." }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("member_credentials")
    .update({
      password_hash: hashPassword(String(next)),
      must_change: false,
      updated_at: new Date().toISOString(),
    })
    .eq("member_id", session.id);

  if (error) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** 비밀번호를 바꿔야 하는 상태인지 알려줍니다. */
export async function GET(req: NextRequest) {
  const session = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ mustChange: false });

  const { data } = await supabaseAdmin
    .from("member_credentials")
    .select("must_change")
    .eq("member_id", session.id)
    .maybeSingle();

  return NextResponse.json({ mustChange: !!data?.must_change });
}

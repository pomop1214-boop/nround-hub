import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/auth";

/** 운영자가 멤버 비밀번호를 새로 지정합니다. 기존 비밀번호는 조회할 수 없습니다. */
export async function POST(req: NextRequest) {
  const { pin, memberId, password } = await req.json();

  if (pin !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: "PIN이 맞지 않아요." }, { status: 401 });
  }
  if (!memberId || !password || String(password).length < 4) {
    return NextResponse.json({ error: "비밀번호는 4자 이상으로 정해주세요." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("member_credentials").upsert(
    {
      member_id: memberId,
      password_hash: hashPassword(String(password)),
      // 운영자가 정해준 건 임시 비밀번호입니다. 본인이 바꾸도록 표시해둡니다.
      must_change: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" }
  );

  if (error) return NextResponse.json({ error: "저장하지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** 비밀번호가 설정된 멤버 id 목록만 돌려줍니다(해시는 내보내지 않습니다). */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("pin") !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: "PIN이 맞지 않아요." }, { status: 401 });
  }
  const { data } = await supabaseAdmin.from("member_credentials").select("member_id, updated_at");
  return NextResponse.json({ set: data ?? [] });
}

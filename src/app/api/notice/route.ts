import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/** 공지 삭제 — 운영자 PIN 확인 후 서버에서 지웁니다. */
export async function DELETE(req: NextRequest) {
  const { pin, id } = await req.json();

  if (pin !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: "운영자만 지울 수 있어요." }, { status: 401 });
  }
  if (!id) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });

  const { error } = await supabaseAdmin.from("announcements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "삭제하지 못했어요." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

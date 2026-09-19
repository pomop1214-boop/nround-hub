import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/** 이 기기의 알림 구독을 서버에서 지웁니다. */
export async function POST(req: NextRequest) {
  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });

  const { error } = await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: "끄지 못했어요." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

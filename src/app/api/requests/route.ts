import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function ok(req: NextRequest, pin: string | null) {
  return pin === process.env.ADMIN_PIN;
}

/** 대기 중인 요청 목록 */
export async function GET(req: NextRequest) {
  if (!ok(req, req.nextUrl.searchParams.get("pin"))) {
    return NextResponse.json({ error: "PIN이 맞지 않아요." }, { status: 401 });
  }
  const { data } = await supabaseAdmin
    .from("member_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return NextResponse.json({ requests: data ?? [] });
}

/** 처리 완료로 표시 */
export async function POST(req: NextRequest) {
  const { pin, id } = await req.json();
  if (!ok(req, pin)) return NextResponse.json({ error: "PIN이 맞지 않아요." }, { status: 401 });

  const { error } = await supabaseAdmin
    .from("member_requests")
    .update({ status: "done" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "처리하지 못했어요." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

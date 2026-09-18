import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/** 누가 어떤 기기에서 알림을 켰는지 (운영진만) */
export async function GET(req: NextRequest) {
  const auth = await checkAdmin(req, req.nextUrl.searchParams.get("pin") ?? undefined, [
    "lead",
    "sub_lead",
  ]);
  if (!auth.ok) return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("push_subscriptions")
    .select("member_id, device, browser, updated_at")
    .not("member_id", "is", null);

  return NextResponse.json({ subs: data ?? [] });
}

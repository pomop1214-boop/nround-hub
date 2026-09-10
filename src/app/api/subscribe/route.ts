import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const subscription = await req.json();

  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .upsert({ endpoint: subscription.endpoint, subscription }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const subscription = await req.json();
  const session = readSession(req.cookies.get(SESSION_COOKIE)?.value);

  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .upsert(
      { endpoint: subscription.endpoint, subscription, member_id: session?.id ?? null },
      { onConflict: "endpoint" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

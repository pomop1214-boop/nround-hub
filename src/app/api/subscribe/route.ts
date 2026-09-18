import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const subscription = await req.json();
  const session = readSession(req.cookies.get(SESSION_COOKIE)?.value);

  const { device, browser, ...sub } = subscription as {
    endpoint: string;
    device?: string;
    browser?: string;
  };

  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      subscription: sub,
      member_id: session?.id ?? null,
      device: device ?? null,
      browser: browser ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

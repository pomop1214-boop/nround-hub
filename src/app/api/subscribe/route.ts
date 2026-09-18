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

  const base = {
    endpoint: sub.endpoint,
    subscription: sub,
    member_id: session?.id ?? null,
  };

  let { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    { ...base, device: device ?? null, browser: browser ?? null, updated_at: new Date().toISOString() },
    { onConflict: "endpoint" }
  );

  // 기기 컬럼이 아직 없는 데이터베이스에서도 알림은 켜지도록 합니다.
  if (error) {
    const retry = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(base, { onConflict: "endpoint" });
    error = retry.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, linked: !!session?.id });
}

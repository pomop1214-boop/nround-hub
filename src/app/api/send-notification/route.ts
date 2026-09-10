import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:nround.crew@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
);

export async function POST(req: NextRequest) {
  const { pin, title, body, url } = await req.json();

  if (pin !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: "PIN이 올바르지 않아요." }, { status: 401 });
  }

  // 구독하지 않은 사람도 볼 수 있게 공지를 먼저 저장합니다.
  await supabaseAdmin.from("announcements").insert({ title, body, url });

  const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("*");

  const results = await Promise.allSettled(
    (subs || []).map((row) =>
      webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url }))
    )
  );

  const failedEndpoints = (subs || [])
    .filter((_, i) => results[i].status === "rejected")
    .map((row) => row.endpoint);

  if (failedEndpoints.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", failedEndpoints);
  }

  return NextResponse.json({ ok: true, sent: results.length, failed: failedEndpoints.length });
}

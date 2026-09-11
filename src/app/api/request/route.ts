import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:nround.crew@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
);

/** 로그인 전에도 보낼 수 있는 요청(가입 / 비밀번호 재발급). 운영장에게 알림이 갑니다. */
export async function POST(req: NextRequest) {
  const { type, name, birthDate } = await req.json();

  if (type !== "join" && type !== "reset") {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }
  if (type === "join" && !birthDate) {
    return NextResponse.json({ error: "생년월일을 입력해주세요." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("member_requests").insert({
    type,
    name: name.trim(),
    birth_date: type === "join" ? birthDate : null,
  });

  if (error) return NextResponse.json({ error: "보내지 못했어요." }, { status: 500 });

  // 운영장 기기로만 알림을 보냅니다.
  try {
    const { data: leads } = await supabaseAdmin
      .from("crew_members")
      .select("id")
      .eq("role", "lead");
    const leadIds = (leads ?? []).map((l) => l.id);

    if (leadIds.length) {
      const { data: subs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("endpoint, subscription")
        .in("member_id", leadIds);

      const title = type === "join" ? "가입 요청이 왔어요" : "비밀번호 재발급 요청";
      const body =
        type === "join" ? `${name.trim()} 님이 가입을 요청했어요.` : `${name.trim()} 님이 비밀번호를 잊었대요.`;

      await Promise.allSettled(
        (subs ?? []).map((row) =>
          webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url: "/admin" }))
        )
      );
    }
  } catch {
    /* 알림은 실패해도 요청 자체는 저장됐으니 성공으로 둡니다 */
  }

  return NextResponse.json({ ok: true });
}

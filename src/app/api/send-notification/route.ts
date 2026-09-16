import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPush } from "@/lib/push-server";
import { checkAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { pin, title, body, url } = await req.json();

  const auth = await checkAdmin(req, pin, ["lead", "sub_lead"]);
  if (!auth.ok) {
    return NextResponse.json({ error: "공지를 보낼 권한이 없어요." }, { status: 401 });
  }

  // 구독하지 않은 사람도 볼 수 있게 공지를 먼저 저장합니다.
  await supabaseAdmin.from("announcements").insert({ title, body, url });

  // 공지는 구독한 모두에게 보냅니다.
  const res = await sendPush({ title, body, url });

  return NextResponse.json({ ok: true, ...res });
}

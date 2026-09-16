import { NextRequest, NextResponse } from "next/server";
import { sendPush } from "@/lib/push-server";
import { checkAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/** 특정 크루원(또는 전체)에게 알림을 보냅니다. */
export async function POST(req: NextRequest) {
  const { pin, title, body, url, memberIds } = await req.json();

  const auth = await checkAdmin(req, pin, ["lead", "sub_lead", "supporter"]);
  if (!auth.ok) {
    return NextResponse.json({ error: "알림을 보낼 권한이 없어요." }, { status: 401 });
  }
  if (!title) return NextResponse.json({ error: "제목이 필요해요." }, { status: 400 });

  const res = await sendPush({ title, body, url }, memberIds ?? null);
  return NextResponse.json({ ok: true, ...res });
}

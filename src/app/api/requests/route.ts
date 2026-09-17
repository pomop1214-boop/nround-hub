import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

function randomPassword() {
  // 헷갈리는 글자(0/O, 1/l)는 뺐어요.
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** 대기 중인 요청 목록 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("pin") !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: "PIN이 맞지 않아요." }, { status: 401 });
  }
  const { data } = await supabaseAdmin
    .from("member_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return NextResponse.json({ requests: data ?? [] });
}

/**
 * 요청 처리.
 * action: "approve" → 가입이면 계정 생성 + 비밀번호 발급, 재발급이면 비밀번호만 새로 발급
 *         "reject"  → 거절 표시만 하고 끝
 */
export async function POST(req: NextRequest) {
  const { pin, id, action } = await req.json();
  if (pin !== process.env.ADMIN_PIN) {
    return NextResponse.json({ error: "PIN이 맞지 않아요." }, { status: 401 });
  }

  const { data: reqRow } = await supabaseAdmin
    .from("member_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!reqRow) return NextResponse.json({ error: "요청을 찾을 수 없어요." }, { status: 404 });

  if (action === "reject") {
    await supabaseAdmin.from("member_requests").update({ status: "rejected" }).eq("id", id);
    return NextResponse.json({ ok: true, rejected: true });
  }

  if (action !== "approve") {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const name = String(reqRow.name).trim();
  const password = randomPassword();

  if (reqRow.type === "join") {
    // 같은 이름이 이미 있으면 새로 만들지 않고 그 사람에게 비밀번호만 발급합니다.
    const { data: existing } = await supabaseAdmin
      .from("crew_members")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    let memberId = existing?.id as string | undefined;

    if (!memberId) {
      // 요청에 적힌 생년월일도 함께 저장합니다(형식이 맞을 때만).
      const birth =
        typeof reqRow.birth_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(reqRow.birth_date)
          ? reqRow.birth_date
          : null;

      const { data: created, error: insErr } = await supabaseAdmin
        .from("crew_members")
        .insert({ name, member_type: "member", active: true, birth_date: birth })
        .select("id")
        .single();
      if (insErr || !created) {
        return NextResponse.json({ error: "계정을 만들지 못했어요." }, { status: 500 });
      }
      memberId = created.id;
    }

    const { error: credErr } = await supabaseAdmin.from("member_credentials").upsert(
      {
        member_id: memberId,
        password_hash: hashPassword(password),
        must_change: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id" }
    );
    if (credErr) return NextResponse.json({ error: "비밀번호를 저장하지 못했어요." }, { status: 500 });

    await supabaseAdmin.from("member_requests").update({ status: "done" }).eq("id", id);
    return NextResponse.json({ ok: true, name, password, created: !existing });
  }

  // 비밀번호 재발급
  const { data: member } = await supabaseAdmin
    .from("crew_members")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (!member) {
    return NextResponse.json(
      { error: `'${name}' 님이 크루원 명단에 없어요. 이름을 확인해주세요.` },
      { status: 404 }
    );
  }

  const { error: credErr } = await supabaseAdmin.from("member_credentials").upsert(
    {
      member_id: member.id,
      password_hash: hashPassword(password),
      must_change: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" }
  );
  if (credErr) return NextResponse.json({ error: "비밀번호를 저장하지 못했어요." }, { status: 500 });

  await supabaseAdmin.from("member_requests").update({ status: "done" }).eq("id", id);
  return NextResponse.json({ ok: true, name, password, created: false });
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPush } from "@/lib/push-server";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { answersOf, isComplete, isTarget, questionsOf, type ResponseRow, type VoteRow } from "@/lib/vote";

export const dynamic = "force-dynamic";

/** 같은 완료 알림을 두 번 보내지 않게 기록합니다. */
async function once(kind: string, targetId: string) {
  const { error } = await supabaseAdmin.from("notify_log").insert({ kind, target_id: targetId });
  // unique 제약에 걸리면 이미 보낸 것입니다.
  return !error;
}

async function leadIds() {
  const { data } = await supabaseAdmin
    .from("crew_members")
    .select("id")
    .in("role", ["lead", "sub_lead"]);
  return (data ?? []).map((r) => r.id);
}

/**
 * 크루원이 한 행동에 따라 알림을 보냅니다.
 * 누구에게 보낼지는 서버가 정합니다.
 */
export async function POST(req: NextRequest) {
  const session = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { type, id } = await req.json();

  /* ── 투표: 모두 응답했으면 운영진에게 ── */
  if (type === "vote_check") {
    const { data: v } = await supabaseAdmin.from("votes").select("*").eq("id", id).maybeSingle();
    if (!v) return NextResponse.json({ ok: true, skipped: "no_vote" });

    const vote = v as VoteRow;
    const [{ data: ms }, { data: rs }] = await Promise.all([
      supabaseAdmin.from("crew_members").select("id, member_type").eq("active", true),
      supabaseAdmin
        .from("vote_responses")
        .select("vote_id, member_id, choice, answers")
        .eq("vote_id", id),
    ]);

    const members = (ms ?? []).filter((m) => isTarget(vote, m));
    const rows = (rs ?? []) as ResponseRow[];
    const qs = questionsOf(vote);
    const done =
      members.length > 0 &&
      members.every((m) => {
        const mine = rows.find((r) => r.member_id === m.id);
        return isComplete(answersOf(mine), qs);
      });

    if (!done) return NextResponse.json({ ok: true, skipped: "not_all" });
    if (!(await once("vote_done", id))) return NextResponse.json({ ok: true, skipped: "sent" });

    await sendPush(
      {
        title: `투표 완료 · ${vote.title}`,
        body: `${members.length}명 모두 응답했어요.`,
        url: "/admin",
      },
      await leadIds()
    );
    return NextResponse.json({ ok: true, sent: "vote_done" });
  }

  /* ── 정산: 보냈어요 → 올린 사람에게 ── */
  if (type === "settle_claimed") {
    const { data: item } = await supabaseAdmin
      .from("settlement_items")
      .select("settlement_id, member_id, amount")
      .eq("id", id)
      .maybeSingle();
    if (!item) return NextResponse.json({ ok: true, skipped: "no_item" });

    const { data: st } = await supabaseAdmin
      .from("settlements")
      .select("id, title, created_by")
      .eq("id", item.settlement_id)
      .maybeSingle();
    if (!st) return NextResponse.json({ ok: true, skipped: "no_settlement" });

    const to = st.created_by ? [st.created_by] : await leadIds();
    await sendPush(
      {
        title: `입금 알림 · ${st.title}`,
        body: `${session.name} 님이 ${Number(item.amount).toLocaleString("ko-KR")}원을 보냈다고 해요.`,
        url: "/admin",
      },
      to
    );
    return NextResponse.json({ ok: true, sent: "settle_claimed" });
  }

  /* ── 정산: 운영자가 확인 → 낸 사람에게, 다 걷혔으면 올린 사람에게 ── */
  if (type === "settle_confirmed") {
    const { data: item } = await supabaseAdmin
      .from("settlement_items")
      .select("settlement_id, member_id, amount")
      .eq("id", id)
      .maybeSingle();
    if (!item) return NextResponse.json({ ok: true, skipped: "no_item" });

    const { data: st } = await supabaseAdmin
      .from("settlements")
      .select("id, title, created_by")
      .eq("id", item.settlement_id)
      .maybeSingle();
    if (!st) return NextResponse.json({ ok: true, skipped: "no_settlement" });

    // 낸 사람에게 확인 완료
    await sendPush(
      { title: `정산 확인 완료 · ${st.title}`, body: "입금이 확인됐어요. 고마워요!", url: "/me" },
      [item.member_id]
    );

    // 모두 냈으면 올린 사람에게도
    const { data: all } = await supabaseAdmin
      .from("settlement_items")
      .select("paid")
      .eq("settlement_id", st.id);
    const rows = all ?? [];
    const allPaid = rows.length > 0 && rows.every((r) => r.paid);

    if (allPaid && (await once("settle_done", st.id))) {
      const to = st.created_by ? [st.created_by] : await leadIds();
      await sendPush(
        { title: `정산 완료 · ${st.title}`, body: `${rows.length}명 모두 입금했어요.`, url: "/admin" },
        to
      );
    }

    return NextResponse.json({ ok: true, sent: "settle_confirmed", allPaid });
  }

  return NextResponse.json({ error: "알 수 없는 요청이에요." }, { status: 400 });
}

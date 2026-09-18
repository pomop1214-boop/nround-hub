import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPush } from "@/lib/push-server";
import { answersOf, isComplete, isTarget, questionsOf, type ResponseRow, type VoteRow } from "@/lib/vote";

export const dynamic = "force-dynamic";

const KST = 9 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** 마감 기준으로 알림을 보낼 시점들 */
type Slot = { key: string; at: number; label: string };

function slotsFor(deadlineMs: number): Slot[] {
  // 마감일(한국 시간) 오전 8시
  const kst = new Date(deadlineMs + KST);
  const morning =
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 8) - KST;

  return [
    { key: "d0_8am", at: morning, label: "오늘 마감이에요" },
    { key: "h5", at: deadlineMs - 5 * HOUR, label: "마감 5시간 전이에요" },
    { key: "h3", at: deadlineMs - 3 * HOUR, label: "마감 3시간 전이에요" },
    { key: "h2", at: deadlineMs - 2 * HOUR, label: "마감 2시간 전이에요" },
    { key: "h1", at: deadlineMs - 1 * HOUR, label: "마감 1시간 전이에요" },
    { key: "m30", at: deadlineMs - 30 * 60 * 1000, label: "마감 30분 전이에요" },
  ].filter((s) => s.at < deadlineMs);
}

/** 이미 보낸 건 건너뛰기 위해 기록을 남깁니다. */
async function alreadySent(kind: string, targetId: string, slot: string) {
  const { data } = await supabaseAdmin
    .from("reminder_log")
    .select("id")
    .eq("kind", kind)
    .eq("target_id", targetId)
    .eq("slot", slot)
    .maybeSingle();
  return !!data;
}

async function markSent(kind: string, targetId: string, slot: string) {
  await supabaseAdmin.from("reminder_log").insert({ kind, target_id: targetId, slot });
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 401 });
  }

  const now = Date.now();
  // 너무 오래 지난 시점은 보내지 않습니다(배포 직후 몰아서 가는 것 방지).
  const floor = now - 12 * HOUR;
  const out: string[] = [];

  const { data: ms } = await supabaseAdmin
    .from("crew_members")
    .select("id, name, member_type")
    .eq("active", true);
  const members = ms ?? [];

  /* ── 투표 ── */
  const { data: vs } = await supabaseAdmin
    .from("votes")
    .select("*")
    .eq("is_open", true)
    .not("deadline", "is", null);

  for (const v of (vs ?? []) as VoteRow[]) {
    if (!v.deadline) continue;
    const dl = new Date(v.deadline).getTime();
    if (dl <= now) continue;

    const due = slotsFor(dl).filter((s) => s.at <= now && s.at > floor);
    if (due.length === 0) continue;

    const { data: rs } = await supabaseAdmin
      .from("vote_responses")
      .select("vote_id, member_id, choice, answers")
      .eq("vote_id", v.id);
    const rows = (rs ?? []) as ResponseRow[];
    const qs = questionsOf(v);

    const missing = members
      .filter((m) => isTarget(v, m))
      .filter((m) => {
        const mine = rows.find((r) => r.member_id === m.id);
        return !isComplete(answersOf(mine), qs);
      })
      .map((m) => m.id);

    for (const slot of due) {
      if (await alreadySent("vote", v.id, slot.key)) continue;
      if (missing.length > 0) {
        await sendPush(
          { title: `투표 · ${v.title}`, body: `${slot.label} 아직 응답하지 않으셨어요.`, url: "/vote" },
          missing
        );
      }
      await markSent("vote", v.id, slot.key);
      out.push(`vote/${v.title}/${slot.key} → ${missing.length}명`);
    }
  }

  /* ── 회비 ── */
  const { data: ps } = await supabaseAdmin
    .from("dues_periods")
    .select("*")
    .eq("is_current", true)
    .not("due_date", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const period = (ps ?? [])[0];
  if (period?.due_date) {
    // 납부 기한은 그날 밤 11시 59분(한국 시간)으로 봅니다.
    const [y, m, d] = String(period.due_date).split("-").map(Number);
    const dl = Date.UTC(y, m - 1, d, 23, 59) - KST;

    if (dl > now) {
      const due = slotsFor(dl).filter((s) => s.at <= now && s.at > floor);

      if (due.length > 0) {
        const { data: pay } = await supabaseAdmin
          .from("dues_payments")
          .select("member_id, paid")
          .eq("period_id", period.id);

        const billed = members.filter(
          (mm) => mm.member_type !== "guest" || period.guest_dues_enabled
        );
        const unpaid = billed
          .filter((mm) => !(pay ?? []).some((p) => p.member_id === mm.id && p.paid))
          .map((mm) => mm.id);

        for (const slot of due) {
          if (await alreadySent("dues", period.id, slot.key)) continue;
          if (unpaid.length > 0) {
            await sendPush(
              { title: `회비 · ${period.label}`, body: `${slot.label} 아직 납부 전이에요.`, url: "/me" },
              unpaid
            );
          }
          await markSent("dues", period.id, slot.key);
          out.push(`dues/${period.label}/${slot.key} → ${unpaid.length}명`);
        }
      }
    }
  }

  /* ── 정산 ── */
  const { data: settles } = await supabaseAdmin
    .from("settlements")
    .select("id, title, due_date")
    .eq("is_open", true)
    .not("due_date", "is", null);

  for (const st of settles ?? []) {
    // 입금 기한은 그날 밤 11시 59분(한국 시간)으로 봅니다.
    const [sy, sm, sd] = String(st.due_date).split("-").map(Number);
    const dl = Date.UTC(sy, sm - 1, sd, 23, 59) - KST;
    if (dl <= now) continue;

    const due = slotsFor(dl).filter((x) => x.at <= now && x.at > floor);
    if (due.length === 0) continue;

    const { data: items } = await supabaseAdmin
      .from("settlement_items")
      .select("member_id, paid")
      .eq("settlement_id", st.id);

    const unpaid = (items ?? []).filter((i) => !i.paid).map((i) => i.member_id);

    for (const slot of due) {
      if (await alreadySent("settle", st.id, slot.key)) continue;
      if (unpaid.length > 0) {
        await sendPush(
          { title: `정산 · ${st.title}`, body: `${slot.label} 아직 입금 전이에요.`, url: "/me" },
          unpaid
        );
      }
      await markSent("settle", st.id, slot.key);
      out.push(`settle/${st.title}/${slot.key} → ${unpaid.length}명`);
    }
  }

  /* ── 생일 ── */
  // 한국 시간 기준 오늘 날짜
  const today = new Date(now + KST);
  const todayKey = today.toISOString().slice(0, 10);   // YYYY-MM-DD
  const mmdd = todayKey.slice(5);                       // MM-DD

  const { data: birthdays } = await supabaseAdmin
    .from("crew_members")
    .select("id, name, birth_date")
    .eq("active", true)
    .not("birth_date", "is", null);

  const todaysBirthdays = (birthdays ?? []).filter(
    (m) => String(m.birth_date).slice(5) === mmdd
  );

  if (todaysBirthdays.length > 0) {
    const { data: leads } = await supabaseAdmin
      .from("crew_members")
      .select("id")
      .eq("role", "lead");
    const leadIds = (leads ?? []).map((l) => l.id);

    for (const m of todaysBirthdays) {
      // 하루에 한 번만 보냅니다.
      if (await alreadySent("birthday", m.id, todayKey)) continue;

      if (leadIds.length > 0) {
        await sendPush(
          {
            title: `🎂 오늘 ${m.name} 님 생일이에요`,
            body: "크루방에 축하 메시지 남겨주세요.",
            url: "/admin",
          },
          leadIds
        );
      }
      await markSent("birthday", m.id, todayKey);
      out.push(`birthday/${m.name}`);
    }
  }

  return NextResponse.json({ ok: true, sent: out });
}

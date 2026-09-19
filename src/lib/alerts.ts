import { supabase } from "@/lib/supabase";
import {
  answersOf,
  isComplete,
  isTarget,
  isVotable,
  questionsOf,
  type ResponseRow,
  type VoteRow,
} from "@/lib/vote";

export type AlertNotice = { id: string; title: string; body: string | null; created_at: string };
export type AlertRule = { id: string; title: string };
export type AlertDues = { id: string; label: string; amount: number; due_date: string | null };
export type AlertSettle = { id: string; title: string; amount: number; due_date: string | null };

export type Alerts = {
  notices: AlertNotice[];
  votes: VoteRow[];
  rules: AlertRule[];
  dues: AlertDues | null;
  settles: AlertSettle[];
  total: number;
};

export const emptyAlerts: Alerts = {
  notices: [],
  votes: [],
  rules: [],
  dues: null,
  settles: [],
  total: 0,
};

/** 한 부분이 실패해도 나머지 알림은 살아있게 각각 감쌉니다. */
async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

/** 이 사람이 아직 확인하지 않은 것들을 모읍니다. */
export async function loadAlerts(meId: string): Promise<Alerts> {
  const notices = await safe(async () => {
    const [{ data: me }, { data: ns }] = await Promise.all([
      supabase.from("crew_members").select("notices_seen_at").eq("id", meId).maybeSingle(),
      supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    // 컬럼이 아직 없으면 로컬 기록으로 대신합니다.
    const seenRaw =
      me?.notices_seen_at ?? (typeof window !== "undefined" ? localStorage.getItem("nround_notice_seen_at") : null);
    const seen = seenRaw ? new Date(seenRaw).getTime() : 0;
    return ((ns ?? []) as AlertNotice[]).filter((n) => new Date(n.created_at).getTime() > seen);
  }, [] as AlertNotice[]);

  const votes = await safe(async () => {
    const [{ data: vs }, { data: me }] = await Promise.all([
      supabase.from("votes").select("*").eq("is_open", true),
      supabase.from("crew_members").select("member_type").eq("id", meId).maybeSingle(),
    ]);
    // 대상이 아닌 투표는 알림에서 뺍니다.
    const list = ((vs ?? []) as VoteRow[])
      .filter((v) => isTarget(v, { id: meId, member_type: me?.member_type }))
      .filter(isVotable);
    if (list.length === 0) return [];
    const { data: rs } = await supabase
      .from("vote_responses")
      .select("vote_id, member_id, choice, answers")
      .eq("member_id", meId)
      .in(
        "vote_id",
        list.map((v) => v.id)
      );
    const rows = (rs ?? []) as ResponseRow[];
    return list.filter(
      (v) => !isComplete(answersOf(rows.find((r) => r.vote_id === v.id)), questionsOf(v))
    );
  }, [] as VoteRow[]);

  const rules = await safe(async () => {
    const [{ data: rl }, { data: tg }, { data: ak }] = await Promise.all([
      supabase.from("rules").select("id, title, version, requires_ack").eq("is_published", true),
      supabase.from("rule_targets").select("rule_id, member_id"),
      supabase.from("rule_acks").select("rule_id, version").eq("member_id", meId),
    ]);
    const acks = ak ?? [];
    return ((rl ?? []) as { id: string; title: string; version: number; requires_ack: boolean }[])
      .filter((r) => {
        if (!r.requires_ack) return false;
        const t = (tg ?? []).filter((x) => x.rule_id === r.id);
        if (t.length > 0 && !t.some((x) => x.member_id === meId)) return false;
        return !acks.some((a) => a.rule_id === r.id && a.version === r.version);
      })
      .map((r) => ({ id: r.id, title: r.title }));
  }, [] as AlertRule[]);

  const dues = await safe(async () => {
    const { data: me } = await supabase
      .from("crew_members")
      .select("member_type")
      .eq("id", meId)
      .maybeSingle();

    const { data: p } = await supabase
      .from("dues_periods")
      .select("*")
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!p) return null;

    const isGuest = me?.member_type === "guest";
    if (isGuest && !p.guest_dues_enabled) return null;

    const { data: pay } = await supabase
      .from("dues_payments")
      .select("paid, visit_count")
      .eq("period_id", p.id)
      .eq("member_id", meId)
      .maybeSingle();
    if (pay?.paid) return null;

    const amount = isGuest ? (pay?.visit_count ?? 0) * p.guest_amount : p.amount;
    if (amount <= 0) return null;

    return { id: p.id, label: p.label, amount, due_date: p.due_date } as AlertDues;
  }, null as AlertDues | null);

  const settles = await safe(async () => {
    const { data: its } = await supabase
      .from("settlement_items")
      .select("id, settlement_id, amount, paid")
      .eq("member_id", meId)
      .eq("paid", false);
    const items = its ?? [];
    if (items.length === 0) return [];

    const { data: ss } = await supabase
      .from("settlements")
      .select("id, title, due_date, is_open")
      .in(
        "id",
        items.map((i) => i.settlement_id)
      );

    return items
      .map((i) => {
        const s = (ss ?? []).find((x) => x.id === i.settlement_id);
        return s && s.is_open
          ? { id: i.id, title: s.title, amount: i.amount, due_date: s.due_date }
          : null;
      })
      .filter((x): x is AlertSettle => !!x);
  }, [] as AlertSettle[]);

  const total = notices.length + votes.length + rules.length + (dues ? 1 : 0) + settles.length;
  return { notices, votes, rules, dues, settles, total };
}

/** 공지를 읽음으로 기록합니다. */
export async function markNoticesSeen(meId: string) {
  const now = new Date().toISOString();
  if (typeof window !== "undefined") localStorage.setItem("nround_notice_seen_at", now);
  try {
    await supabase.from("crew_members").update({ notices_seen_at: now }).eq("id", meId);
  } catch {
    /* 컬럼이 없으면 로컬 기록만 씁니다 */
  }
}

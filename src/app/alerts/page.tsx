"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";
import { answersOf, isComplete, questionsOf, type ResponseRow, type VoteRow } from "@/lib/vote";
import { won, type Settlement, type SettlementItem } from "@/lib/settlement";

const ME_KEY = "nround_me_v1";

type Notice = { id: string; title: string; body: string | null; created_at: string };
type Rule = { id: string; title: string; version: number; requires_ack: boolean };

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [votesTodo, setVotesTodo] = useState<VoteRow[]>([]);
  const [rulesTodo, setRulesTodo] = useState<Rule[]>([]);
  const [duesOwed, setDuesOwed] = useState<{ label: string; amount: number } | null>(null);
  const [settleOwed, setSettleOwed] = useState<{ s: Settlement; it: SettlementItem }[]>([]);

  const load = useCallback(async () => {
    const meId = localStorage.getItem(ME_KEY);
    if (!meId) {
      setLoading(false);
      return;
    }

    const [{ data: me }, { data: vs }, { data: ns }] = await Promise.all([
      supabase.from("crew_members").select("id, member_type, notices_seen_at").eq("id", meId).maybeSingle(),
      supabase.from("votes").select("*").eq("is_open", true),
      supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    // 안 읽은 공지
    const seen = me?.notices_seen_at ? new Date(me.notices_seen_at).getTime() : 0;
    setNotices(((ns ?? []) as Notice[]).filter((n) => new Date(n.created_at).getTime() > seen));

    // 미응답 투표
    const voteList = (vs ?? []) as VoteRow[];
    if (voteList.length) {
      const { data: rs } = await supabase
        .from("vote_responses")
        .select("vote_id, member_id, choice, answers")
        .eq("member_id", meId)
        .in("vote_id", voteList.map((v) => v.id));
      const rows = (rs ?? []) as ResponseRow[];
      setVotesTodo(
        voteList.filter((v) => !isComplete(answersOf(rows.find((r) => r.vote_id === v.id)), questionsOf(v)))
      );
    }

    // 확인 필요 규정
    const [{ data: rules }, { data: targets }, { data: acks }] = await Promise.all([
      supabase.from("rules").select("id, title, version, requires_ack").eq("is_published", true),
      supabase.from("rule_targets").select("rule_id, member_id"),
      supabase.from("rule_acks").select("rule_id, version").eq("member_id", meId),
    ]);
    setRulesTodo(
      ((rules ?? []) as Rule[]).filter((r) => {
        if (!r.requires_ack) return false;
        const tg = (targets ?? []).filter((t) => t.rule_id === r.id);
        if (tg.length > 0 && !tg.some((t) => t.member_id === meId)) return false;
        return !(acks ?? []).some((a) => a.rule_id === r.id && a.version === r.version);
      })
    );

    // 미납 회비
    const { data: periods } = await supabase
      .from("dues_periods")
      .select("*")
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(1);
    const cur = (periods ?? [])[0];
    if (cur) {
      const { data: pay } = await supabase
        .from("dues_payments")
        .select("paid, visit_count")
        .eq("period_id", cur.id)
        .eq("member_id", meId)
        .maybeSingle();
      const guest = me?.member_type === "guest";
      const owe = guest
        ? cur.guest_dues_enabled
          ? (pay?.visit_count ?? 0) * cur.guest_amount
          : 0
        : cur.amount;
      if (!pay?.paid && owe > 0) setDuesOwed({ label: cur.label, amount: owe });
    }

    // 미납 정산
    const { data: its } = await supabase
      .from("settlement_items")
      .select("*")
      .eq("member_id", meId)
      .eq("paid", false);
    const itemRows = (its ?? []) as SettlementItem[];
    if (itemRows.length) {
      const { data: ss } = await supabase
        .from("settlements")
        .select("*")
        .in("id", itemRows.map((i) => i.settlement_id))
        .eq("is_open", true);
      const sList = (ss ?? []) as Settlement[];
      setSettleOwed(
        itemRows
          .map((it) => ({ it, s: sList.find((x) => x.id === it.settlement_id) }))
          .filter((x): x is { it: SettlementItem; s: Settlement } => !!x.s)
      );
    }

    setLoading(false);

    // 공지함을 열었으니 읽음 처리
    await supabase.from("crew_members").update({ notices_seen_at: new Date().toISOString() }).eq("id", meId);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <main className="nr-page">
        <SubHeader title="알림" />
        <div className="nr-card" style={{ height: 120, opacity: 0.55 }} />
      </main>
    );
  }

  const total =
    notices.length + votesTodo.length + rulesTodo.length + (duesOwed ? 1 : 0) + settleOwed.length;

  return (
    <main className="nr-page">
      <SubHeader title="알림" />

      {total === 0 && (
        <div className="nr-empty">
          확인할 게 없어요.
          <br />
          새 소식이 오면 여기에 모여요.
        </div>
      )}

      {votesTodo.length > 0 && (
        <section className="mb-5">
          <h2 className="nr-h2">응답하지 않은 투표</h2>
          <div className="mt-2 flex flex-col gap-2">
            {votesTodo.map((v) => (
              <Link key={v.id} href="/vote" className="nr-card nr-card-tint flex items-center gap-3 p-3.5">
                <span className="nr-iconbox">
                  <Icon name="chart" size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
                  {v.title}
                </span>
                <Icon name="chevron" size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {(duesOwed || settleOwed.length > 0) && (
        <section className="mb-5">
          <h2 className="nr-h2">내지 않은 금액</h2>
          <div className="mt-2 flex flex-col gap-2">
            {duesOwed && (
              <Link href="/me" className="nr-card nr-card-tint flex items-center gap-3 p-3.5">
                <span className="nr-iconbox">
                  <Icon name="wallet" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
                    {duesOwed.label}
                  </span>
                  <span className="text-[11.5px]" style={{ color: "var(--red-deep)" }}>
                    {won(duesOwed.amount)}
                  </span>
                </span>
                <Icon name="chevron" size={16} />
              </Link>
            )}
            {settleOwed.map(({ s, it }) => (
              <Link key={it.id} href="/me" className="nr-card nr-card-tint flex items-center gap-3 p-3.5">
                <span className="nr-iconbox">
                  <Icon name="wallet" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
                    {s.title}
                  </span>
                  <span className="text-[11.5px]" style={{ color: "var(--red-deep)" }}>
                    {won(it.amount)}
                    {it.claimed_at ? " · 확인 대기중" : ""}
                  </span>
                </span>
                <Icon name="chevron" size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {rulesTodo.length > 0 && (
        <section className="mb-5">
          <h2 className="nr-h2">확인하지 않은 규정</h2>
          <div className="mt-2 flex flex-col gap-2">
            {rulesTodo.map((r) => (
              <Link key={r.id} href="/rules" className="nr-card nr-card-tint flex items-center gap-3 p-3.5">
                <span className="nr-iconbox">
                  <Icon name="doc" size={18} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
                  {r.title}
                </span>
                <Icon name="chevron" size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {notices.length > 0 && (
        <section>
          <h2 className="nr-h2">새 공지</h2>
          <div className="mt-2 flex flex-col gap-2">
            {notices.map((n) => (
              <div key={n.id} className="nr-card p-3.5">
                <p className="text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: "#4a3f39" }}>
                    {n.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

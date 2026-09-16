"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Icon from "./Icon";
import { answersOf, isComplete, questionsOf, type ResponseRow, type VoteRow } from "@/lib/vote";

const ME_KEY = "nround_me_v1";
const SEEN_KEY = "nround_notice_seen_at";

/** 홈 상단 종 — 확인하지 않은 것이 있으면 빨간 점이 붙습니다. */
export default function BellButton() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    const meId = localStorage.getItem(ME_KEY);
    if (!meId) return;

    try {
      const seenAt = localStorage.getItem(SEEN_KEY) ?? "1970-01-01";
      let n = 0;

      // 안 읽은 공지
      const { count: noticeCount } = await supabase
        .from("announcements")
        .select("id", { count: "exact", head: true })
        .gt("created_at", seenAt);
      n += noticeCount ?? 0;

      // 미응답 투표
      const { data: vs } = await supabase.from("votes").select("*").eq("is_open", true);
      const votes = (vs ?? []) as VoteRow[];
      if (votes.length) {
        const { data: rs } = await supabase
          .from("vote_responses")
          .select("vote_id, member_id, choice, answers")
          .eq("member_id", meId)
          .in(
            "vote_id",
            votes.map((v) => v.id)
          );
        const rows = (rs ?? []) as ResponseRow[];
        n += votes.filter((v) => {
          const mine = rows.find((r) => r.vote_id === v.id);
          return !isComplete(answersOf(mine), questionsOf(v));
        }).length;
      }

      // 미납 회비
      const { data: period } = await supabase
        .from("dues_periods")
        .select("id, guest_dues_enabled")
        .eq("is_current", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (period) {
        const { data: pay } = await supabase
          .from("dues_payments")
          .select("paid")
          .eq("period_id", period.id)
          .eq("member_id", meId)
          .maybeSingle();
        if (!pay?.paid) n += 1;
      }

      // 미납 정산
      const { data: items } = await supabase
        .from("settlement_items")
        .select("settlement_id, paid")
        .eq("member_id", meId)
        .eq("paid", false);
      n += (items ?? []).length;

      setCount(n);
    } catch {
      /* 종 배지는 실패해도 화면에 영향을 주지 않습니다 */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Link href="/alerts" className="relative" aria-label="알림">
      <span style={{ color: "var(--body)" }}>
        <Icon name="bell" size={20} />
      </span>
      {count > 0 && (
        <span
          className="absolute grid place-items-center rounded-full text-[9px] font-bold"
          style={{
            top: -4,
            right: -5,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            background: "var(--red)",
            color: "#fff",
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { answersOf, isComplete, questionsOf, type ResponseRow, type VoteRow } from "@/lib/vote";

const FINE_PER_UNIT = 5000; // 3회당 벌금
const STRIKES_PER_FINE = 3;

type Member = { id: string; name: string; role: string | null };

const ROLE_ORDER: Record<string, number> = { lead: 0, sub_lead: 1, supporter: 2 };
function byRoleThenName(a: Member, b: Member) {
  const ra = a.role ? ROLE_ORDER[a.role] ?? 3 : 3;
  const rb = b.role ? ROLE_ORDER[b.role] ?? 3 : 3;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name, "ko");
}

type Strike = {
  id: string;
  member_id: string;
  reason: string;
  vote_id: string | null;
  settled: boolean;
  created_at: string;
};

function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export default function StrikesPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [openVoteId, setOpenVoteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ms }, { data: vs }, { data: ss }] = await Promise.all([
        supabase.from("crew_members").select("id, name, role").eq("active", true).order("name"),
        supabase.from("votes").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("strikes").select("*").order("created_at", { ascending: false }),
      ]);

      setMembers(((ms ?? []) as Member[]).sort(byRoleThenName));
      setVotes((vs ?? []) as VoteRow[]);
      setStrikes((ss ?? []) as Strike[]);

      const ids = (vs ?? []).map((v) => v.id);
      if (ids.length) {
        const { data: rs } = await supabase
          .from("vote_responses")
          .select("vote_id, member_id, choice, answers")
          .in("vote_id", ids);
        setRows((rs ?? []) as ResponseRow[]);
      }
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unsettledCount = useCallback(
    (memberId: string) => strikes.filter((s) => s.member_id === memberId && !s.settled).length,
    [strikes]
  );

  const nameOf = useCallback((id: string) => members.find((m) => m.id === id)?.name ?? "?", [members]);

  // 마감이 지났는데 아직 응답하지 않은 사람들
  const pending = useMemo(() => {
    const nowMs = Date.now();
    return votes
      .filter((v) => v.deadline && new Date(v.deadline).getTime() < nowMs)
      .map((v) => {
        const qs = questionsOf(v);
        // 질문을 다 채운 사람만 "응답함"으로 봅니다(하나만 누르고 만 경우는 미응답).
        const done = rows
          .filter((r) => r.vote_id === v.id && isComplete(answersOf(r), qs))
          .map((r) => r.member_id);
        const missing = members.filter(
          (m) => !done.includes(m.id) && !strikes.some((s) => s.vote_id === v.id && s.member_id === m.id)
        );
        return { vote: v, missing };
      })
      .filter((p) => p.missing.length > 0);
  }, [votes, rows, members, strikes]);

  async function addStrike(memberId: string, reason: string, voteId: string | null) {
    const { error: e } = await supabase
      .from("strikes")
      .insert({ member_id: memberId, reason, vote_id: voteId });
    if (e) return setError(e.code === "23505" ? "이미 기록된 건이에요." : "기록하지 못했어요.");
    setError("");
    load();
  }

  async function addAllForVote(voteId: string, title: string, missing: Member[]) {
    const rows = missing.map((m) => ({
      member_id: m.id,
      reason: `${title} 미응답`,
      vote_id: voteId,
    }));
    const { error: e } = await supabase.from("strikes").insert(rows);
    if (e) return setError("기록하지 못했어요.");
    setError("");
    load();
  }

  async function removeStrike(id: string) {
    await supabase.from("strikes").delete().eq("id", id);
    load();
  }

  async function settle(memberId: string) {
    const count = unsettledCount(memberId);
    const units = Math.floor(count / STRIKES_PER_FINE);
    if (units === 0) return;
    if (!confirm(`${nameOf(memberId)} 님의 벌금 ${won(units * FINE_PER_UNIT)} 정산 완료로 처리할까요?`)) return;
    // 오래된 것부터 3회 단위로만 정산 처리하고, 나머지는 다음으로 이월합니다.
    const ids = strikes
      .filter((s) => s.member_id === memberId && !s.settled)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, units * STRIKES_PER_FINE)
      .map((s) => s.id);
    await supabase.from("strikes").update({ settled: true }).in("id", ids);
    load();
  }

  function copyTagText(title: string, missing: Member[]) {
    const text =
      missing.map((m) => "@" + m.name).join(" ") +
      `\n[${title}] 아직 응답 안 하신 분들이에요. 확인 부탁드려요!`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) return <p className="nr-more">불러오는 중...</p>;

  const totalFine = members.reduce(
    (sum, m) => sum + Math.floor(unsettledCount(m.id) / STRIKES_PER_FINE) * FINE_PER_UNIT,
    0
  );

  return (
    <section>
      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}
      {copied && (
        <p className="mb-2 text-[12px]" style={{ color: "var(--mint-text)" }}>
          태그 문구를 복사했어요. 단톡방에 붙여넣으세요.
        </p>
      )}

      {pending.length > 0 && (
        <div className="mb-4">
          <p className="nr-h2">마감 지난 미응답</p>
          <div className="mt-2 flex flex-col gap-2">
            {pending.map(({ vote, missing }) => (
              <div key={vote.id} className="nr-card nr-card-tint p-3.5">
                <p className="text-[14.5px] font-bold" style={{ color: "var(--ink)" }}>{vote.title}</p>
                <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
                  미응답 {missing.length}명 · {missing.map((m) => m.name).join(", ")}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => copyTagText(vote.title, missing)} className="nr-btn-sm flex-1">
                    카톡 태그 문구 복사
                  </button>
                  <button
                    onClick={() => addAllForVote(vote.id, vote.title, missing)}
                    className="nr-btn-sm nr-btn-sm-solid flex-1"
                  >
                    전원 미확인 1회 기록
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="nr-h2">누적 현황</p>
        {totalFine > 0 && (
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>미정산 합계 {won(totalFine)}</p>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {members.map((m) => {
          const count = unsettledCount(m.id);
          const units = Math.floor(count / STRIKES_PER_FINE);
          const fine = units * FINE_PER_UNIT;
          const mine = strikes.filter((s) => s.member_id === m.id && !s.settled);
          const isOpen = openVoteId === m.id;
          return (
            <div key={m.id} className={"nr-card p-3 " + (fine > 0 ? "nr-card-tint" : "")}>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[14.5px] font-bold" style={{ color: "var(--ink)" }}>{m.name}</span>
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                  {count}회{count > 0 && ` / ${STRIKES_PER_FINE}`}
                </span>
                {fine > 0 && <span className="nr-badge nr-badge-red">{won(fine)}</span>}
              </div>

              <div className="mt-2 flex gap-1.5">
                <button onClick={() => addStrike(m.id, "직접 기록", null)} className="nr-btn-sm">+1회</button>
                <button onClick={() => setOpenVoteId(isOpen ? null : m.id)} className="nr-btn-sm">
                  내역 {count > 0 ? `(${count})` : ""}
                </button>
                {fine > 0 && (
                  <button onClick={() => settle(m.id)} className="nr-btn-sm nr-btn-sm-solid ml-auto">
                    벌금 냈어요
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="mt-2 flex flex-col gap-1">
                  {mine.length === 0 && (
                    <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>기록이 없어요.</p>
                  )}
                  {mine.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 text-[11.5px]"
                      style={{ color: "var(--muted)" }}
                    >
                      <span className="flex-1">
                        {s.reason} · {s.created_at.slice(5, 10).replace("-", "/")}
                      </span>
                      <button
                        onClick={() => removeStrike(s.id)}
                        className="underline"
                        style={{ color: "var(--muted)" }}
                      >
                        취소
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
        {STRIKES_PER_FINE}회가 쌓이면 벌금 {won(FINE_PER_UNIT)}이에요. &apos;벌금 냈어요&apos;를 누르면{" "}
        {STRIKES_PER_FINE}회씩 정산 처리되고, 남는 횟수는 다음으로 이어져요. 이 화면은 크루원에게 보이지 않아요.
      </p>
    </section>
  );
}

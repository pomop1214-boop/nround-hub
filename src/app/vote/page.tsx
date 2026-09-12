"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";
import {
  answersOf,
  fmtDeadline,
  isComplete,
  questionsOf,
  type Answers,
  type Question,
  type ResponseRow,
  type VoteRow,
} from "@/lib/vote";

const ME_KEY = "nround_me_v1";

export default function VotePage() {
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [mine, setMine] = useState<Record<string, Answers>>({});
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async (memberId: string | null) => {
    setLoading(true);
    try {
      const { data: vs } = await supabase
        .from("votes")
        .select("*")
        .eq("is_open", true)
        .order("created_at", { ascending: false });
      const list = (vs ?? []) as VoteRow[];
      setVotes(list);

      if (memberId && list.length) {
        const { data: rs } = await supabase
          .from("vote_responses")
          .select("vote_id, member_id, choice, answers")
          .eq("member_id", memberId)
          .in(
            "vote_id",
            list.map((v) => v.id)
          );
        const map: Record<string, Answers> = {};
        ((rs ?? []) as ResponseRow[]).forEach((r) => {
          map[r.vote_id] = answersOf(r);
        });
        setMine(map);
      }
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(ME_KEY);
    setMeId(stored);
    load(stored);
  }, [load]);

  async function save(voteId: string, next: Answers) {
    if (!meId) return;
    const prev = mine;
    setMine({ ...mine, [voteId]: next });
    const { error: e } = await supabase.from("vote_responses").upsert(
      { vote_id: voteId, member_id: meId, answers: next },
      { onConflict: "vote_id,member_id" }
    );
    if (e) {
      setMine(prev);
      setError("저장하지 못했어요.");
      return;
    }
    setSavedAt(voteId);
    setTimeout(() => setSavedAt(null), 1500);
  }

  function toggle(vote: VoteRow, q: Question, option: string) {
    const cur = mine[vote.id] ?? {};
    let next: Answers;
    if (q.type === "multi") {
      const arr = Array.isArray(cur[q.id]) ? (cur[q.id] as string[]) : [];
      next = {
        ...cur,
        [q.id]: arr.includes(option) ? arr.filter((o) => o !== option) : [...arr, option],
      };
    } else {
      next = { ...cur, [q.id]: cur[q.id] === option ? undefined : option };
    }
    save(vote.id, next);
  }

  function setText(vote: VoteRow, q: Question, value: string) {
    const cur = mine[vote.id] ?? {};
    setMine({ ...mine, [vote.id]: { ...cur, [q.id]: value } });
  }

  if (loading) {
    return (
      <main className="nr-page">
        <SubHeader title="활동 투표" />
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="nr-card" style={{ height: 120, opacity: 0.55 }} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="nr-page">
      <SubHeader title="활동 투표" />

      {error && <p className="text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      <div className="flex flex-col gap-3">
        {votes.length === 0 && (
          <div className="nr-empty">
            진행 중인 투표가 없어요.
            <br />새 투표가 열리면 여기에 표시돼요.
          </div>
        )}

        {votes.map((v) => {
          const qs = questionsOf(v);
          const a = mine[v.id] ?? {};
          const done = isComplete(a, qs);
          return (
            <div key={v.id} className="nr-card p-4">
              <div className="flex items-center gap-2">
                <span className="nr-badge nr-badge-live">진행중</span>
                <span className="nr-badge nr-badge-tint">{v.category}</span>
                {v.deadline && (
                  <span
                    className="ml-auto flex items-center gap-1 text-[11.5px]"
                    style={{ color: "var(--muted)" }}
                  >
                    <Icon name="clock" size={13} />
                    {fmtDeadline(v.deadline)}
                  </span>
                )}
              </div>

              <p className="mt-2.5 text-[16px] font-extrabold" style={{ color: "var(--ink)" }}>
                {v.title}
              </p>

              {qs.map((q) => (
                <div key={q.id} className="mt-5">
                  <p className="text-[12.5px] font-bold" style={{ color: "var(--ink)" }}>
                    {q.label}
                    {q.type === "multi" && (
                      <span className="ml-1 font-normal" style={{ color: "var(--muted)" }}>
                        · 여러 개 선택 가능
                      </span>
                    )}
                  </p>

                  {q.type === "text" ? (
                    <textarea
                      value={(a[q.id] as string) ?? ""}
                      onChange={(e) => setText(v, q, e.target.value)}
                      onBlur={() => save(v.id, a)}
                      rows={2}
                      placeholder="자유롭게 적어주세요"
                      className="nr-input mt-2"
                      style={{ fontSize: 14 }}
                    />
                  ) : (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {q.options.map((o) => {
                        const on =
                          q.type === "multi"
                            ? Array.isArray(a[q.id]) && (a[q.id] as string[]).includes(o)
                            : a[q.id] === o;
                        return (
                          <button
                            key={o}
                            onClick={() => toggle(v, q, o)}
                            disabled={!meId}
                            className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-left"
                            style={
                              on
                                ? { border: "1.5px solid var(--red)", background: "var(--red-wash)" }
                                : { border: "1px solid var(--border)" }
                            }
                          >
                            <span
                              className="shrink-0"
                              style={{
                                width: 17,
                                height: 17,
                                borderRadius: q.type === "multi" ? 5 : "50%",
                                border: on ? "5px solid var(--red)" : "1.5px solid #DCD6D5",
                                background: "#fff",
                              }}
                            />
                            <span
                              className="text-[14px]"
                              style={{
                                color: on ? "var(--red-deep)" : "var(--ink)",
                                fontWeight: on ? 700 : 500,
                              }}
                            >
                              {o}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <p className="mt-4 text-[11.5px]" style={{ color: done ? "var(--mint-text)" : "var(--muted)" }}>
                {savedAt === v.id
                  ? "저장했어요"
                  : done
                  ? "응답 완료 · 마감 전까지 바꿀 수 있어요"
                  : "고르는 대로 저장돼요"}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}

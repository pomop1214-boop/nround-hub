"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";
import {
  answersOf,
  isAnswered,
  fmtDeadline,
  isComplete,
  isTarget,
  questionsOf,
  stopsAt,
  visibleQuestions,
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
  /** 수정 중인 투표 id. 여기 있으면 입력 화면, 없으면 완료 화면. */
  const [editing, setEditing] = useState<string | null>(null);
  /** 제출 전 임시 답안 */
  const [draft, setDraft] = useState<Record<string, Answers>>({});
  const [justSent, setJustSent] = useState<string | null>(null);

  const load = useCallback(async (memberId: string | null) => {
    setLoading(true);
    try {
      const [{ data: vs }, { data: me }] = await Promise.all([
        supabase
          .from("votes")
          .select("*")
          .eq("is_open", true)
          .order("created_at", { ascending: false }),
        memberId
          ? supabase.from("crew_members").select("member_type").eq("id", memberId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      // 회원만 참여하는 투표는 비회원에게 보이지 않습니다.
      const list = ((vs ?? []) as VoteRow[]).filter((v) =>
        isTarget(v, { id: memberId ?? "", member_type: me?.member_type })
      );
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

  async function submit(voteId: string) {
    if (!meId) return;
    const next = draft[voteId] ?? {};
    const { error: e } = await supabase.from("vote_responses").upsert(
      { vote_id: voteId, member_id: meId, answers: next },
      { onConflict: "vote_id,member_id" }
    );
    if (e) {
      setError("제출하지 못했어요.");
      return;
    }
    setMine({ ...mine, [voteId]: next });
    setEditing(null);
    setJustSent(voteId);
    setTimeout(() => setJustSent(null), 2500);

    // 이 응답으로 전원 완료가 됐는지는 서버가 판단합니다.
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "vote_check", id: voteId }),
    }).catch(() => {});
  }

  function startEdit(v: VoteRow) {
    setDraft({ ...draft, [v.id]: mine[v.id] ?? {} });
    setEditing(v.id);
  }

  function toggle(vote: VoteRow, q: Question, option: string) {
    const cur = draft[vote.id] ?? {};
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
    setDraft({ ...draft, [vote.id]: next });
  }

  function setText(vote: VoteRow, q: Question, value: string) {
    const cur = draft[vote.id] ?? {};
    setDraft({ ...draft, [vote.id]: { ...cur, [q.id]: value } });
  }

  /** 내가 고른 답을 사람이 읽기 좋게 */
  function summaryOf(v: VoteRow) {
    const a = mine[v.id] ?? {};
    return visibleQuestions(questionsOf(v), a)
      .filter((q) => isAnswered(a, q))
      .map((q) => {
        const val = a[q.id];
        return { label: q.label, text: Array.isArray(val) ? val.join(", ") : String(val ?? "") };
      });
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
          const saved = mine[v.id] ?? {};
          const done = isComplete(saved, qs);
          const isEditing = editing === v.id || !done;
          const a = isEditing ? draft[v.id] ?? saved : saved;
          const ready = isComplete(a, qs);

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

              {/* ── 제출 완료 ── */}
              {!isEditing ? (
                <>
                  <div
                    className="mt-3 rounded-xl p-3.5"
                    style={{ background: "var(--mint-bg)", border: "1px solid var(--mint)" }}
                  >
                    <p
                      className="flex items-center gap-1.5 text-[13.5px] font-bold"
                      style={{ color: "var(--mint-text)" }}
                    >
                      <Icon name="check" size={15} />
                      제출되었습니다
                    </p>

                    <div className="mt-2.5 flex flex-col gap-2">
                      {summaryOf(v).map((row) => (
                        <div key={row.label}>
                          <p className="text-[11px]" style={{ color: "var(--mint-text)", opacity: 0.8 }}>
                            {row.label}
                          </p>
                          <p className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
                            {row.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {justSent === v.id && (
                    <p className="mt-2 text-[11.5px]" style={{ color: "var(--mint-text)" }}>
                      방금 제출했어요.
                    </p>
                  )}

                  <button onClick={() => startEdit(v)} className="nr-btn nr-btn-ghost mt-3 py-3">
                    수정하기
                  </button>
                </>
              ) : (
                /* ── 입력 ── */
                <>
                  {visibleQuestions(qs, a).map((q) => (
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

                  {stopsAt(qs, a) !== null && stopsAt(qs, a)! < qs.length - 1 && (
                    <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>
                      나머지 질문은 답하지 않아도 돼요.
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    {done && (
                      <button
                        onClick={() => setEditing(null)}
                        className="nr-btn nr-btn-ghost flex-1 py-3"
                      >
                        취소
                      </button>
                    )}
                    <button
                      onClick={() => submit(v.id)}
                      disabled={!ready}
                      className="nr-btn nr-btn-primary flex-1"
                      style={ready ? undefined : { opacity: 0.5 }}
                    >
                      {done ? "수정 완료" : "제출하기"}
                    </button>
                  </div>

                  {!ready && (
                    <p className="mt-2 text-center text-[11.5px]" style={{ color: "var(--muted)" }}>
                      모든 질문에 답해주세요
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

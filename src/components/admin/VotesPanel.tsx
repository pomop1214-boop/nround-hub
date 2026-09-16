"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import {
  answersOf,
  fmtDeadline,
  newQuestionId,
  pickedBy,
  questionsOf,
  type Question,
  type QuestionType,
  type ResponseRow,
  type VoteRow,
} from "@/lib/vote";

const CATEGORIES = ["월 참여", "주 참여", "기타"] as const;

type Member = { id: string; name: string; role: string | null };

const ROLE_ORDER: Record<string, number> = { lead: 0, sub_lead: 1, supporter: 2 };
function byRoleThenName(a: Member, b: Member) {
  const ra = a.role ? ROLE_ORDER[a.role] ?? 3 : 3;
  const rb = b.role ? ROLE_ORDER[b.role] ?? 3 : 3;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name, "ko");
}

type Draft = {
  id: string;
  title: string;
  category: string;
  deadline: string;
  questions: Question[];
};

function emptyDraft(): Draft {
  return {
    id: "",
    title: "",
    category: "주 참여",
    deadline: "",
    questions: [{ id: newQuestionId(), label: "참석 여부", type: "single", options: ["참석", "불참"] }],
  };
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function VotesPanel() {
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: vs }, { data: ms }] = await Promise.all([
        supabase.from("votes").select("*").order("created_at", { ascending: false }),
        supabase.from("crew_members").select("id, name, role").eq("active", true),
      ]);
      const list = (vs ?? []) as VoteRow[];
      setVotes(list);
      setMembers(((ms ?? []) as Member[]).sort(byRoleThenName));

      if (list.length) {
        const { data: rs } = await supabase
          .from("vote_responses")
          .select("vote_id, member_id, choice, answers")
          .in(
            "vote_id",
            list.map((v) => v.id)
          );
        setResponses((rs ?? []) as ResponseRow[]);
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

  /* ── 질문 편집 ─────────────────────────── */

  function patchQ(qid: string, patch: Partial<Question>) {
    if (!draft) return;
    setDraft({
      ...draft,
      questions: draft.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)),
    });
  }

  function addQuestion() {
    if (!draft) return;
    setDraft({
      ...draft,
      questions: [
        ...draft.questions,
        { id: newQuestionId(), label: "", type: "single", options: ["", ""] },
      ],
    });
  }

  function removeQuestion(qid: string) {
    if (!draft) return;
    setDraft({ ...draft, questions: draft.questions.filter((q) => q.id !== qid) });
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.title.trim()) return setError("투표 제목을 입력해주세요.");

    const cleaned = draft.questions
      .map((q) => ({
        ...q,
        label: q.label.trim(),
        options: q.type === "text" ? [] : q.options.map((o) => o.trim()).filter(Boolean),
      }))
      .filter((q) => q.label);

    if (cleaned.length === 0) return setError("질문을 하나 이상 만들어주세요.");
    const bad = cleaned.find((q) => q.type !== "text" && q.options.length < 2);
    if (bad) return setError(`"${bad.label}" 질문의 보기를 두 개 이상 적어주세요.`);

    const payload = {
      title: draft.title.trim(),
      category: draft.category,
      questions: cleaned,
      options: [],
      deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
    };

    const { error: e2 } = draft.id
      ? await supabase.from("votes").update(payload).eq("id", draft.id)
      : await supabase.from("votes").insert({ ...payload, is_open: true });

    if (e2) return setError("저장하지 못했어요.");

    // 새 투표는 활동중인 크루원 모두에게 알립니다.
    if (!draft.id) {
      try {
        const pin = localStorage.getItem("nround-admin-pin") ?? "";
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin,
            title: `새 투표 · ${payload.title}`,
            body: payload.deadline ? `${fmtDeadline(payload.deadline)}까지 응답해주세요` : "응답해주세요",
            url: "/vote",
            memberIds: members.map((m) => m.id),
          }),
        });
      } catch {
        /* 알림 실패해도 투표는 만들어졌습니다 */
      }
    }
    setError("");
    setDraft(null);
    load();
  }

  async function setOpen(v: VoteRow, open: boolean) {
    await supabase.from("votes").update({ is_open: open }).eq("id", v.id);
    load();
  }

  async function remove(v: VoteRow) {
    if (!confirm(`"${v.title}" 투표를 삭제할까요?\n응답 기록도 함께 지워져요.`)) return;
    await supabase.from("votes").delete().eq("id", v.id);
    load();
  }

  function rowsFor(voteId: string) {
    return responses.filter((r) => r.vote_id === voteId);
  }
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  function copySummary(v: VoteRow) {
    const qs = questionsOf(v);
    const rows = rowsFor(v.id);
    const lines: string[] = [`[${v.title}]`, `응답 ${rows.length} / ${members.length}명`, ""];

    qs.forEach((q) => {
      lines.push(`■ ${q.label}`);
      if (q.type === "text") {
        rows.forEach((r) => {
          const t = answersOf(r)[q.id];
          if (typeof t === "string" && t.trim()) lines.push(`  - ${nameOf(r.member_id)}: ${t.trim()}`);
        });
      } else {
        q.options.forEach((o) => {
          const who = pickedBy(rows, q, o);
          lines.push(`  ${o} ${who.length}명${who.length ? " — " + who.map((r) => nameOf(r.member_id)).join(", ") : ""}`);
        });
      }
      lines.push("");
    });

    const answered = rows.map((r) => r.member_id);
    const missing = members.filter((m) => !answered.includes(m.id));
    if (missing.length) lines.push(`미응답 ${missing.length}명 — ${missing.map((m) => m.name).join(", ")}`);

    navigator.clipboard.writeText(lines.join("\n"));
  }

  if (loading) return <p className="nr-more">불러오는 중...</p>;

  return (
    <section>
      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {!draft && (
        <button onClick={() => setDraft(emptyDraft())} className="nr-btn nr-btn-primary mb-3">
          <Icon name="plus" size={17} /> 새 투표 만들기
        </button>
      )}

      {/* ── 만들기 · 수정 ── */}
      {draft && (
        <form onSubmit={saveDraft} className="nr-card mb-4 flex flex-col gap-2.5 p-3.5">
          <p className="nr-h2">{draft.id ? "투표 수정" : "새 투표"}</p>

          <input
            autoFocus
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="투표 제목 (예: 9월 넷째 주 모임)"
            className="nr-input"
          />

          <div className="flex gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft({ ...draft, category: c })}
                className={"nr-btn-sm flex-1 " + (draft.category === c ? "nr-btn-sm-solid" : "")}
              >
                {c}
              </button>
            ))}
          </div>

          <label className="text-[11.5px]" style={{ color: "var(--muted)" }}>
            마감 (선택)
          </label>
          <input
            type="datetime-local"
            value={draft.deadline}
            onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
            className="nr-input"
          />

          {/* 질문들 */}
          {draft.questions.map((q, i) => (
            <div
              key={q.id}
              className="rounded-xl p-3"
              style={{ background: "var(--red-wash)", border: "1px solid var(--red-tint)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>
                  질문 {i + 1}
                </span>
                {draft.questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(q.id)}
                    className="ml-auto text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    질문 삭제
                  </button>
                )}
              </div>

              <input
                value={q.label}
                onChange={(e) => patchQ(q.id, { label: e.target.value })}
                placeholder="질문 (예: 연습실 참여)"
                className="nr-input mt-2"
                style={{ fontSize: 14 }}
              />

              <div className="mt-2 flex gap-1.5">
                {(
                  [
                    ["single", "하나만"],
                    ["multi", "여러 개"],
                    ["text", "주관식"],
                  ] as [QuestionType, string][]
                ).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => patchQ(q.id, { type: t })}
                    className={"nr-btn-sm flex-1 " + (q.type === t ? "nr-btn-sm-solid" : "")}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {q.type !== "text" && (
                <>
                  <textarea
                    value={q.options.join("\n")}
                    onChange={(e) => patchQ(q.id, { options: e.target.value.split("\n") })}
                    rows={Math.max(2, q.options.length)}
                    placeholder={"보기를 한 줄에 하나씩\n참석\n불참"}
                    className="nr-input mt-2"
                    style={{ fontSize: 14 }}
                  />
                  <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                    한 줄에 하나씩 적어주세요
                  </p>
                </>
              )}
            </div>
          ))}

          <button type="button" onClick={addQuestion} className="nr-btn-sm">
            + 질문 추가
          </button>

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setError("");
              }}
              className="nr-btn nr-btn-ghost flex-1 py-2.5"
            >
              취소
            </button>
            <button type="submit" className="nr-btn nr-btn-primary flex-1 py-2.5">
              저장
            </button>
          </div>
        </form>
      )}

      {/* ── 목록 ── */}
      <div className="flex flex-col gap-2">
        {votes.length === 0 && <p className="nr-empty">아직 만든 투표가 없어요.</p>}

        {votes.map((v) => {
          const qs = questionsOf(v);
          const rows = rowsFor(v.id);
          const answered = rows.map((r) => r.member_id);
          const missing = members.filter((m) => !answered.includes(m.id));
          const showing = openId === v.id;

          return (
            <div key={v.id} className="nr-card p-4">
              <div className="flex items-center gap-2">
                <span className={"nr-badge " + (v.is_open ? "nr-badge-live" : "nr-badge-tint")}>
                  {v.is_open ? "진행중" : "마감"}
                </span>
                <span className="nr-badge nr-badge-tint">{v.category}</span>
                {v.deadline && (
                  <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>
                    {fmtDeadline(v.deadline)}
                  </span>
                )}
              </div>

              <p className="mt-2 text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
                {v.title}
              </p>
              <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
                질문 {qs.length}개 · 응답 {rows.length}/{members.length}명
                {missing.length > 0 && ` · 미응답 ${missing.map((m) => m.name).join(", ")}`}
              </p>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button onClick={() => setOpenId(showing ? null : v.id)} className="nr-btn-sm">
                  {showing ? "집계 닫기" : "집계 보기"}
                </button>
                <button
                  onClick={() =>
                    setDraft({
                      id: v.id,
                      title: v.title,
                      category: v.category,
                      deadline: toLocalInput(v.deadline),
                      questions: questionsOf(v),
                    })
                  }
                  className="nr-btn-sm"
                >
                  수정
                </button>
                <Link href={`/vote/report/${v.id}`} className="nr-btn-sm">
                  PDF로 저장
                </Link>
                <button onClick={() => copySummary(v)} className="nr-btn-sm">
                  집계 복사
                </button>
                <button onClick={() => setOpen(v, !v.is_open)} className="nr-btn-sm">
                  {v.is_open ? "마감하기" : "다시 열기"}
                </button>
                <button
                  onClick={() => remove(v)}
                  className="nr-btn-sm"
                  style={{ borderColor: "transparent", background: "transparent" }}
                >
                  삭제
                </button>
              </div>

              {showing && (
                <div className="mt-3 flex flex-col gap-4">
                  {qs.map((q) => (
                    <div key={q.id}>
                      <p className="text-[12.5px] font-bold" style={{ color: "var(--ink)" }}>
                        {q.label}
                      </p>

                      {q.type === "text" ? (
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          {rows
                            .map((r) => ({ r, t: answersOf(r)[q.id] }))
                            .filter((x) => typeof x.t === "string" && x.t.trim())
                            .map(({ r, t }) => (
                              <div
                                key={r.member_id}
                                className="rounded-lg px-3 py-2"
                                style={{ background: "var(--red-wash)" }}
                              >
                                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                                  {nameOf(r.member_id)}
                                </span>
                                <p className="text-[12.5px]" style={{ color: "var(--ink)" }}>
                                  {t as string}
                                </p>
                              </div>
                            ))}
                          {rows.every((r) => {
                            const t = answersOf(r)[q.id];
                            return !(typeof t === "string" && t.trim());
                          }) && (
                            <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                              작성한 사람이 없어요.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1">
                          {q.options.map((o) => {
                            const who = pickedBy(rows, q, o);
                            const pct = rows.length ? Math.round((who.length / rows.length) * 100) : 0;
                            return (
                              <div key={o} className="py-1.5">
                                <div className="flex items-center gap-2 text-[12.5px]">
                                  <span className="flex-1 font-semibold" style={{ color: "var(--ink)" }}>
                                    {o}
                                  </span>
                                  <span style={{ color: "var(--muted)" }}>{who.length}명</span>
                                </div>
                                <div className="nr-bar mt-1.5">
                                  <div className="nr-bar-fill" style={{ width: `${pct}%` }} />
                                </div>
                                {who.length > 0 && (
                                  <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                                    {who.map((r) => nameOf(r.member_id)).join(", ")}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

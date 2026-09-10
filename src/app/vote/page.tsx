"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "1214";
const ME_KEY = "nround_me_v1";
const CATEGORIES = ["월 참여", "주 참여", "기타"] as const;

type Member = { id: string; name: string };
type Vote = {
  id: string;
  title: string;
  category: string;
  options: string[];
  deadline: string | null;
  is_open: boolean;
};
type Response = { vote_id: string; member_id: string; choice: string };

function fmtDeadline(iso: string) {
  const d = new Date(iso);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) 마감`;
}

export default function VotePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [meId, setMeId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");

  const [creating, setCreating] = useState(false);
  const [nTitle, setNTitle] = useState("");
  const [nCategory, setNCategory] = useState<string>("월 참여");
  const [nOptions, setNOptions] = useState("참석\n불참");
  const [nDeadline, setNDeadline] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ms }, { data: vs }] = await Promise.all([
        supabase.from("crew_members").select("id, name").eq("active", true).order("name"),
        supabase.from("votes").select("*").eq("is_open", true).order("created_at", { ascending: false }),
      ]);
      setMembers((ms ?? []) as Member[]);
      setVotes((vs ?? []) as Vote[]);

      const ids = (vs ?? []).map((v) => v.id);
      if (ids.length) {
        const { data: rs } = await supabase
          .from("vote_responses")
          .select("vote_id, member_id, choice")
          .in("vote_id", ids);
        setResponses((rs ?? []) as Response[]);
      } else {
        setResponses([]);
      }
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setMeId(localStorage.getItem(ME_KEY));
    load();
  }, [load]);

  async function castVote(voteId: string, choice: string) {
    if (!meId) return;
    const prev = responses;
    setResponses([
      ...responses.filter((r) => !(r.vote_id === voteId && r.member_id === meId)),
      { vote_id: voteId, member_id: meId, choice },
    ]);
    const { error: e } = await supabase
      .from("vote_responses")
      .upsert({ vote_id: voteId, member_id: meId, choice }, { onConflict: "vote_id,member_id" });
    if (e) {
      setResponses(prev);
      setError("저장에 실패했어요.");
    }
  }

  async function createVote(e: React.FormEvent) {
    e.preventDefault();
    const opts = nOptions.split("\n").map((o) => o.trim()).filter(Boolean);
    if (!nTitle.trim()) return setError("투표 제목을 입력해주세요.");
    if (opts.length < 2) return setError("보기를 두 개 이상 적어주세요.");
    setError("");
    const { error: e2 } = await supabase.from("votes").insert({
      title: nTitle.trim(),
      category: nCategory,
      options: opts,
      deadline: nDeadline ? new Date(nDeadline).toISOString() : null,
    });
    if (e2) return setError("만들지 못했어요.");
    setNTitle("");
    setNOptions("참석\n불참");
    setNDeadline("");
    setCreating(false);
    load();
  }

  async function closeVote(id: string) {
    await supabase.from("votes").update({ is_open: false }).eq("id", id);
    load();
  }

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  if (loading) {
    return (
      <main className="nr-page">
        <SubHeader title="활동 투표" />
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="nr-card" style={{ height: 62, opacity: 0.55 }} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="nr-page">
      <SubHeader
        title="활동 투표"
        right={
          !isAdmin ? (
            <button onClick={() => setPinOpen((v) => !v)} className="nr-btn-sm">운영자</button>
          ) : undefined
        }
      />

      {error && <p className="text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {pinOpen && !isAdmin && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin === ADMIN_PIN) {
              setIsAdmin(true);
              setPinOpen(false);
              setPin("");
            } else setError("PIN이 맞지 않아요.");
          }}
          className="mt-3 flex gap-2"
        >
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="운영자 PIN"
            className="nr-input flex-1"
          />
          <button type="submit" className="nr-btn-sm nr-btn-sm-solid px-4">확인</button>
        </form>
      )}

      {isAdmin && (
        <div className="mt-4">
          {creating ? (
            <form onSubmit={createVote} className="nr-card flex flex-col gap-2 p-3.5">
              <input
                autoFocus
                value={nTitle}
                onChange={(e) => setNTitle(e.target.value)}
                placeholder="투표 제목 (예: 8월 정기모임 참석)"
                className="nr-input"
              />
              <div className="flex gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNCategory(c)}
                    className={"nr-btn-sm flex-1 " + (nCategory === c ? "nr-btn-sm-solid" : "")}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <textarea
                value={nOptions}
                onChange={(e) => setNOptions(e.target.value)}
                rows={3}
                placeholder={"보기를 한 줄에 하나씩\n참석\n불참"}
                className="nr-input"
              />
              <input
                type="datetime-local"
                value={nDeadline}
                onChange={(e) => setNDeadline(e.target.value)}
                className="nr-input"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setCreating(false)} className="nr-btn nr-btn-ghost flex-1 py-2.5">
                  취소
                </button>
                <button type="submit" className="nr-btn nr-btn-primary flex-1 py-2.5">만들기</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setCreating(true)} className="nr-btn nr-btn-primary">
              <Icon name="plus" size={17} /> 새 투표 만들기
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {votes.length === 0 && (
          <div className="nr-empty">
            진행중인 투표가 없어요.
            {!isAdmin && (
              <>
                <br />
                새 투표가 열리면 여기에 표시돼요.
              </>
            )}
          </div>
        )}

        {votes.map((v) => {
          const mine = responses.find((r) => r.vote_id === v.id && r.member_id === meId);
          const forVote = responses.filter((r) => r.vote_id === v.id);
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

              {isAdmin ? (
                <>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {v.options.map((o) => {
                      const picked = forVote.filter((r) => r.choice === o);
                      const pct = forVote.length ? Math.round((picked.length / forVote.length) * 100) : 0;
                      return (
                        <div key={o} className="py-1.5">
                          <div className="flex items-center gap-2 text-[13px]">
                            <span className="flex-1 font-semibold" style={{ color: "var(--ink)" }}>{o}</span>
                            <span style={{ color: "var(--muted)" }}>{picked.length}명</span>
                            <span className="font-bold" style={{ color: "var(--ink)", minWidth: 34, textAlign: "right" }}>
                              {pct}%
                            </span>
                          </div>
                          <div className="nr-bar mt-1.5">
                            <div className="nr-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          {picked.length > 0 && (
                            <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
                              {picked.map((r) => nameOf(r.member_id)).join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                    미응답 {members.length - forVote.length}명
                  </p>
                  <button
                    onClick={() => closeVote(v.id)}
                    className="mt-2 text-[11.5px] underline"
                    style={{ color: "var(--muted)" }}
                  >
                    투표 마감하기
                  </button>
                </>
              ) : (
                <div className="mt-3 flex flex-col gap-1.5">
                  {v.options.map((o) => {
                    const on = mine?.choice === o;
                    const picked = forVote.filter((r) => r.choice === o).length;
                    const pct = forVote.length ? Math.round((picked / forVote.length) * 100) : 0;
                    return (
                      <button
                        key={o}
                        onClick={() => castVote(v.id, o)}
                        disabled={!meId}
                        className="flex items-center gap-3 py-2 text-left"
                      >
                        <span
                          className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                          style={{
                            border: on ? "5px solid var(--red)" : "1.5px solid #DCD6D5",
                            background: "#fff",
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className="block text-[14px]"
                            style={{ color: "var(--ink)", fontWeight: on ? 700 : 500 }}
                          >
                            {o}
                          </span>
                          <span className="nr-bar mt-1.5 block">
                            <span className="nr-bar-fill block" style={{ width: `${pct}%` }} />
                          </span>
                        </span>
                        <span className="text-[12px]" style={{ color: "var(--muted)", minWidth: 30, textAlign: "right" }}>
                          {picked}명
                        </span>
                      </button>
                    );
                  })}
                  {mine && (
                    <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
                      저장됐어요 · 다른 보기를 누르면 바꿀 수 있어요
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

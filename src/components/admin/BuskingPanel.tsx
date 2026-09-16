"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import { fmtDeadline, isClosed, type Round, type Submission } from "@/lib/busking";

type Member = { id: string; name: string };

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function BuskingPanel() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const [editing, setEditing] = useState<null | {
    id: string;
    title: string;
    event_date: string;
    deadline: string;
    notice: string;
  }>(null);

  const load = useCallback(async (keepId?: string | null) => {
    setLoading(true);
    try {
      const [{ data: rs }, { data: ms }] = await Promise.all([
        supabase.from("busking_rounds").select("*").order("created_at", { ascending: false }),
        supabase.from("crew_members").select("id, name").eq("active", true).order("name"),
      ]);
      const list = (rs ?? []) as Round[];
      setRounds(list);
      setMembers((ms ?? []) as Member[]);

      const target = keepId ?? activeId ?? list.find((r) => r.is_open)?.id ?? list[0]?.id ?? null;
      setActiveId(target);

      if (target) {
        const { data: ss } = await supabase
          .from("busking_submissions")
          .select("*")
          .eq("round_id", target)
          .order("created_at", { ascending: false });
        setSubs((ss ?? []) as Submission[]);
      } else {
        setSubs([]);
      }
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function pickRound(id: string) {
    setActiveId(id);
    setOpenId(null);
    const { data: ss } = await supabase
      .from("busking_submissions")
      .select("*")
      .eq("round_id", id)
      .order("created_at", { ascending: false });
    setSubs((ss ?? []) as Submission[]);
  }

  async function saveRound(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editing.title.trim()) return setError("회차 이름을 입력해주세요.");

    const payload = {
      title: editing.title.trim(),
      event_date: editing.event_date || null,
      deadline: editing.deadline ? new Date(editing.deadline).toISOString() : null,
      notice: editing.notice.trim() || null,
    };

    if (editing.id) {
      const { error: e2 } = await supabase.from("busking_rounds").update(payload).eq("id", editing.id);
      if (e2) return setError("저장하지 못했어요.");
      setEditing(null);
      load(editing.id);
    } else {
      // 새 회차를 열면 기존에 열린 회차는 닫습니다.
      await supabase.from("busking_rounds").update({ is_open: false }).eq("is_open", true);
      const { data, error: e2 } = await supabase
        .from("busking_rounds")
        .insert({ ...payload, is_open: true })
        .select("id")
        .single();
      if (e2 || !data) return setError("만들지 못했어요.");
      setEditing(null);
      load(data.id);
    }
    setError("");
  }

  async function setOpen(r: Round, open: boolean) {
    if (open) await supabase.from("busking_rounds").update({ is_open: false }).eq("is_open", true);
    await supabase.from("busking_rounds").update({ is_open: open }).eq("id", r.id);
    load(r.id);
  }

  async function removeRound(r: Round) {
    if (!confirm(`"${r.title}" 회차를 삭제할까요?\n이 회차의 신청 기록도 함께 지워져요.`)) return;
    await supabase.from("busking_rounds").delete().eq("id", r.id);
    setActiveId(null);
    load(null);
  }

  /** 곡 선곡 토글 — 선곡된 곡만 크루원이 MR을 올릴 수 있습니다. */
  async function toggleConfirm(s: Submission, idx: number) {
    const next = s.songs.map((g, i) => (i === idx ? { ...g, confirmed: !g.confirmed } : g));
    const { error: e } = await supabase.from("busking_submissions").update({ songs: next }).eq("id", s.id);
    if (e) return setError("저장하지 못했어요.");
    setSubs((cur) => cur.map((x) => (x.id === s.id ? { ...x, songs: next } : x)));
  }

  async function removeSub(s: Submission) {
    if (!confirm(`${s.name} 님의 신청을 삭제할까요?`)) return;
    await supabase.from("busking_submissions").delete().eq("id", s.id);
    load(activeId);
  }

  function copyList() {
    const lines: string[] = [`[${active?.title ?? "버스킹"}]`];
    subs
      .filter((s) => s.status === "submitted")
      .forEach((s) => {
        lines.push(`\n■ ${s.name} (${s.experience === "first" ? "첫 참여" : "경험 있음"})`);
        s.songs.forEach((g, i) => {
          lines.push(
            `  ${i + 1}. ${g.title}${g.artist ? " - " + g.artist : ""} [${g.type === "duet" ? "듀엣" : "솔로"}${
              g.level ? "/" + g.level : ""
            }]${g.partner ? " · " + g.partner : ""}${g.confirmed ? " ★선곡" : ""}`
          );
        });
      });
    const declined = subs.filter((s) => s.status === "declined").map((s) => s.name);
    if (declined.length) lines.push(`\n불참 ${declined.length}명 — ${declined.join(", ")}`);
    const responded = subs.map((s) => s.member_id);
    const missing = members.filter((m) => !responded.includes(m.id));
    if (missing.length) lines.push(`미응답 ${missing.length}명 — ${missing.map((m) => m.name).join(", ")}`);
    navigator.clipboard.writeText(lines.join("\n"));
  }

  if (loading) return <p className="nr-more">불러오는 중...</p>;

  const active = rounds.find((r) => r.id === activeId) ?? null;
  const submitted = subs.filter((s) => s.status === "submitted");
  const declined = subs.filter((s) => s.status === "declined");
  const responded = subs.map((s) => s.member_id);
  const missing = members.filter((m) => !responded.includes(m.id));
  const totalSongs = submitted.reduce((n, s) => n + (s.songs?.length ?? 0), 0);
  const pickedCount = submitted.reduce((n, s) => n + s.songs.filter((g) => g.confirmed).length, 0);
  const missingInst = submitted.reduce(
    (n, s) => n + s.songs.filter((g) => g.confirmed && !g.instUrl).length,
    0
  );

  return (
    <section>
      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {!editing && (
        <button
          onClick={() =>
            setEditing({ id: "", title: "", event_date: "", deadline: "", notice: "" })
          }
          className="nr-btn nr-btn-primary mb-3"
        >
          <Icon name="plus" size={17} /> 새 버스킹 열기
        </button>
      )}

      {editing && (
        <form onSubmit={saveRound} className="nr-card mb-3 flex flex-col gap-2 p-3.5">
          <p className="nr-h2">{editing.id ? "회차 수정" : "새 버스킹"}</p>
          <input
            autoFocus
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            placeholder="회차 이름 (예: 10월 홍대 버스킹)"
            className="nr-input"
          />
          <label className="text-[11.5px]" style={{ color: "var(--muted)" }}>
            공연 날짜 (선택)
          </label>
          <input
            type="date"
            value={editing.event_date}
            onChange={(e) => setEditing({ ...editing, event_date: e.target.value })}
            className="nr-input"
          />
          <label className="text-[11.5px]" style={{ color: "var(--muted)" }}>
            신청 마감 (선택)
          </label>
          <input
            type="datetime-local"
            value={editing.deadline}
            onChange={(e) => setEditing({ ...editing, deadline: e.target.value })}
            className="nr-input"
          />
          <textarea
            value={editing.notice}
            onChange={(e) => setEditing({ ...editing, notice: e.target.value })}
            rows={2}
            placeholder="안내 문구 (선택)"
            className="nr-input"
            style={{ fontSize: 14 }}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(null)} className="nr-btn nr-btn-ghost flex-1 py-2.5">
              취소
            </button>
            <button type="submit" className="nr-btn nr-btn-primary flex-1 py-2.5">
              {editing.id ? "저장" : "열기"}
            </button>
          </div>
          {!editing.id && (
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              새로 열면 기존에 열려 있던 회차는 자동으로 닫혀요.
            </p>
          )}
        </form>
      )}

      {/* 회차 고르기 */}
      {rounds.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {rounds.map((r) => (
            <button
              key={r.id}
              onClick={() => pickRound(r.id)}
              className={"nr-btn-sm " + (r.id === activeId ? "nr-btn-sm-solid" : "")}
            >
              {r.title}
              {r.is_open ? " ·진행중" : ""}
            </button>
          ))}
        </div>
      )}

      {rounds.length === 0 && <p className="nr-empty">아직 연 버스킹이 없어요.</p>}

      {active && (
        <>
          <div className="nr-card p-3.5">
            <div className="flex items-center gap-2">
              <span className={"nr-badge " + (isClosed(active) ? "nr-badge-tint" : "nr-badge-live")}>
                {isClosed(active) ? "마감" : "신청중"}
              </span>
              <span className="text-[14.5px] font-extrabold" style={{ color: "var(--ink)" }}>
                {active.title}
              </span>
            </div>
            <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
              {active.event_date ? `공연 ${active.event_date}` : "공연 날짜 없음"}
              {active.deadline ? ` · ${fmtDeadline(active.deadline)} 마감` : " · 마감 없음"}
            </p>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                onClick={() =>
                  setEditing({
                    id: active.id,
                    title: active.title,
                    event_date: active.event_date ?? "",
                    deadline: toLocalInput(active.deadline),
                    notice: active.notice ?? "",
                  })
                }
                className="nr-btn-sm"
              >
                수정
              </button>
              <button onClick={() => setOpen(active, !active.is_open)} className="nr-btn-sm">
                {active.is_open ? "신청 닫기" : "다시 열기"}
              </button>
              <button onClick={copyList} className="nr-btn-sm">
                목록 복사
              </button>
              <button
                onClick={() => removeRound(active)}
                className="nr-btn-sm"
                style={{ borderColor: "transparent", background: "transparent" }}
              >
                회차 삭제
              </button>
            </div>
          </div>

          <div
            className="mt-3 rounded-xl px-4 py-3"
            style={{ background: "var(--mint-bg)", border: "1px solid var(--mint)" }}
          >
            <p className="text-[13.5px] font-bold" style={{ color: "var(--mint-text)" }}>
              신청 {submitted.length}명 · {totalSongs}곡 중 {pickedCount}곡 선곡
            </p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--mint-text)" }}>
              불참 {declined.length} · 미응답 {missing.length}
              {missingInst > 0 && ` · MR 미제출 ${missingInst}곡`}
            </p>
          </div>

          {missing.length > 0 && (
            <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
              미응답 — {missing.map((m) => m.name).join(", ")}
            </p>
          )}

          <p className="nr-h2 mt-4">신청 목록</p>
          <div className="mt-2 flex flex-col gap-2">
            {subs.length === 0 && <p className="nr-empty">아직 신청이 없어요.</p>}

            {subs.map((s) => {
              const showing = openId === s.id;
              return (
                <div key={s.id} className="nr-card p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[14.5px] font-bold" style={{ color: "var(--ink)" }}>
                      {s.name}
                    </span>
                    {s.status === "declined" ? (
                      <span className="nr-badge nr-badge-tint">불참</span>
                    ) : (
                      <span className="nr-badge nr-badge-live">{s.songs?.length ?? 0}곡</span>
                    )}
                    <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>
                      {s.created_at.slice(5, 10).replace("-", "/")}
                    </span>
                  </div>

                  {s.status === "submitted" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button onClick={() => setOpenId(showing ? null : s.id)} className="nr-btn-sm">
                        {showing ? "접기" : "곡 보기 · 선곡"}
                      </button>
                      <button
                        onClick={() => removeSub(s)}
                        className="nr-btn-sm"
                        style={{ borderColor: "transparent", background: "transparent" }}
                      >
                        삭제
                      </button>
                    </div>
                  )}

                  {showing && (
                    <div className="mt-2 flex flex-col gap-2">
                      {s.songs.map((g, i) => (
                        <div
                          key={i}
                          className="rounded-xl p-3"
                          style={{
                            background: g.confirmed ? "var(--mint-bg)" : "var(--red-wash)",
                            border: g.confirmed ? "1px solid var(--mint)" : "1px solid transparent",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                              {g.title}
                            </span>
                            {g.level && <span className="nr-badge nr-badge-tint">{g.level}</span>}
                            <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>
                              {g.type === "duet" ? "듀엣" : "솔로"}
                            </span>
                          </div>
                          {(g.artist || g.partner) && (
                            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                              {g.artist}
                              {g.partner ? ` · ${g.partner} 님과` : ""}
                            </p>
                          )}
                          {g.reason && (
                            <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                              {g.reason}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => toggleConfirm(s, i)}
                              className={"nr-btn-sm " + (g.confirmed ? "nr-btn-sm-solid" : "")}
                            >
                              {g.confirmed ? "선곡 취소" : "이 곡 선곡"}
                            </button>

                            {g.confirmed &&
                              (g.instUrl ? (
                                <a
                                  href={g.instUrl}
                                  download
                                  className="nr-btn-sm flex items-center gap-1"
                                  style={{ color: "var(--red-deep)" }}
                                >
                                  <Icon name="arrow" size={12} />
                                  MR 받기
                                </a>
                              ) : (
                                <span className="text-[11px]" style={{ color: "var(--red-deep)" }}>
                                  MR 기다리는 중
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import { fmtDeadline, isClosed, type BuskingConfig, type Submission } from "@/lib/busking";

type Member = { id: string; name: string };

export default function BuskingPanel() {
  const [cfg, setCfg] = useState<BuskingConfig | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: c }, { data: s }, { data: ms }] = await Promise.all([
        supabase.from("busking_config").select("*").eq("id", 1).maybeSingle(),
        supabase.from("busking_submissions").select("*").order("created_at", { ascending: false }),
        supabase.from("crew_members").select("id, name").eq("active", true).order("name"),
      ]);
      const conf = (c ?? null) as BuskingConfig | null;
      setCfg(conf);
      setSubs((s ?? []) as Submission[]);
      setMembers((ms ?? []) as Member[]);
      if (conf?.deadline) {
        const d = new Date(conf.deadline);
        const p = (n: number) => String(n).padStart(2, "0");
        setDeadline(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
      }
      setNotice(conf?.notice ?? "");
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveConfig() {
    const { error: e } = await supabase.from("busking_config").upsert({
      id: 1,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      notice: notice.trim() || null,
    });
    if (e) return setError("저장하지 못했어요.");
    setError("");
    load();
  }

  async function clearDeadline() {
    await supabase.from("busking_config").upsert({ id: 1, deadline: null });
    setDeadline("");
    load();
  }

  async function removeSub(s: Submission) {
    if (!confirm(`${s.name} 님의 신청을 삭제할까요?`)) return;
    await supabase.from("busking_submissions").delete().eq("id", s.id);
    load();
  }

  function copyList() {
    const lines: string[] = ["[버스킹 곡신청]"];
    subs
      .filter((s) => s.status === "submitted")
      .forEach((s) => {
        lines.push(`\n■ ${s.name} (${s.experience === "first" ? "첫 참여" : "경험 있음"})`);
        s.songs.forEach((g, i) => {
          lines.push(
            `  ${i + 1}. ${g.title}${g.artist ? " - " + g.artist : ""} [${g.type === "duet" ? "듀엣" : "솔로"}${
              g.level ? "/" + g.level : ""
            }]${g.partner ? " · " + g.partner : ""}`
          );
        });
      });
    const declined = subs.filter((s) => s.status === "declined").map((s) => s.name);
    if (declined.length) lines.push(`\n불참 ${declined.length}명 — ${declined.join(", ")}`);
    const submitted = subs.map((s) => s.member_id);
    const missing = members.filter((m) => !submitted.includes(m.id));
    if (missing.length) lines.push(`미응답 ${missing.length}명 — ${missing.map((m) => m.name).join(", ")}`);
    navigator.clipboard.writeText(lines.join("\n"));
  }

  if (loading) return <p className="nr-more">불러오는 중...</p>;

  const submitted = subs.filter((s) => s.status === "submitted");
  const declined = subs.filter((s) => s.status === "declined");
  const responded = subs.map((s) => s.member_id);
  const missing = members.filter((m) => !responded.includes(m.id));
  const closed = isClosed(cfg);
  const totalSongs = submitted.reduce((n, s) => n + (s.songs?.length ?? 0), 0);

  return (
    <section>
      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {/* 마감 · 안내 */}
      <div className="nr-card p-3.5">
        <p className="nr-h2">신청 설정</p>
        <label className="mt-2 block text-[11.5px]" style={{ color: "var(--muted)" }}>
          마감 시간 {closed && "· 지금은 마감 상태예요"}
        </label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="nr-input mt-1"
        />
        <textarea
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          rows={2}
          placeholder="안내 문구 (선택) — 신청 화면 위에 보여요"
          className="nr-input mt-2"
          style={{ fontSize: 14 }}
        />
        <div className="mt-2 flex gap-2">
          <button onClick={clearDeadline} className="nr-btn-sm flex-1 py-2">
            마감 해제
          </button>
          <button onClick={saveConfig} className="nr-btn-sm nr-btn-sm-solid flex-1 py-2">
            저장
          </button>
        </div>
      </div>

      {/* 요약 */}
      <div
        className="mt-3 flex items-center justify-between rounded-xl px-4 py-3"
        style={{ background: "var(--mint-bg)", border: "1px solid var(--mint)" }}
      >
        <span className="text-[13.5px] font-bold" style={{ color: "var(--mint-text)" }}>
          신청 {submitted.length}명 · {totalSongs}곡
        </span>
        <span className="text-[12px]" style={{ color: "var(--mint-text)" }}>
          불참 {declined.length} · 미응답 {missing.length}
        </span>
      </div>

      <div className="mt-2 flex gap-2">
        <button onClick={copyList} className="nr-btn-sm flex-1 py-2">
          전체 목록 복사
        </button>
      </div>

      {missing.length > 0 && (
        <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
          미응답 — {missing.map((m) => m.name).join(", ")}
        </p>
      )}

      {/* 신청 목록 */}
      <div className="mt-4 flex flex-col gap-2">
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
                    {showing ? "접기" : "곡 보기"}
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
                    <div key={i} className="rounded-xl p-3" style={{ background: "var(--red-wash)" }}>
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
                      {g.instUrl && (
                        <a
                          href={g.instUrl}
                          download
                          className="mt-2 flex items-center gap-1.5 text-[11.5px] font-bold"
                          style={{ color: "var(--red-deep)" }}
                        >
                          <Icon name="arrow" size={13} />
                          MR 내려받기 · {g.instName}
                        </a>
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

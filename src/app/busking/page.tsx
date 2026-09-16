"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";
import {
  MIN_SONGS,
  canSubmit,
  confirmedSongs,
  emptySong,
  fmtDeadline,
  isClosed,
  levelFromViews,
  type Round,
  type Song,
  type Submission,
} from "@/lib/busking";

const ME_KEY = "nround_me_v1";
const NAME_KEY = "nround_me_name";

type Step = "intro" | "rules" | "experience" | "songs" | "status";

export default function BuskingPage() {
  const [round, setRound] = useState<Round | null>(null);
  const [sub, setSub] = useState<Submission | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [meName, setMeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [step, setStep] = useState<Step>("intro");
  const [experience, setExperience] = useState<"first" | "experienced" | null>(null);
  const [songs, setSongs] = useState<Song[]>([emptySong(), emptySong()]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [checking, setChecking] = useState<number | null>(null);
  const [autoNote, setAutoNote] = useState("");

  const load = useCallback(async (id: string | null) => {
    setLoading(true);
    try {
      const { data: r } = await supabase
        .from("busking_rounds")
        .select("*")
        .eq("is_open", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const cur = (r ?? null) as Round | null;
      setRound(cur);

      if (cur && id) {
        const { data: s } = await supabase
          .from("busking_submissions")
          .select("*")
          .eq("round_id", cur.id)
          .eq("member_id", id)
          .maybeSingle();
        const mine = (s ?? null) as Submission | null;
        setSub(mine);
        if (mine) {
          setExperience(mine.experience);
          setSongs(mine.songs?.length ? mine.songs : [emptySong(), emptySong()]);
          setStep("status");
        }
      }
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = localStorage.getItem(ME_KEY);
    setMeId(id);
    setMeName(localStorage.getItem(NAME_KEY) ?? "");
    load(id);
  }, [load]);

  const closed = isClosed(round);
  const picked = confirmedSongs(sub);

  async function save(status: "submitted" | "declined", nextSongs: Song[]) {
    if (!meId || !round) return;
    setBusy(true);
    const payload = {
      round_id: round.id,
      name: meName,
      member_id: meId,
      status,
      experience: status === "declined" ? null : experience,
      songs: status === "declined" ? [] : nextSongs,
    };
    const { error: e } = sub
      ? await supabase.from("busking_submissions").update(payload).eq("id", sub.id)
      : await supabase.from("busking_submissions").insert(payload);
    setBusy(false);
    if (e) return setError("제출하지 못했어요. 잠시 후 다시 시도해주세요.");
    setError("");
    await load(meId);
    setStep("status");
  }

  /** MR은 이미 제출된 신청의 곡에 붙입니다. */
  async function saveInst(songIndex: number, url: string, fileName: string) {
    if (!sub) return;
    const next = sub.songs.map((g, i) => (i === songIndex ? { ...g, instUrl: url, instName: fileName } : g));
    const { error: e } = await supabase.from("busking_submissions").update({ songs: next }).eq("id", sub.id);
    if (e) return setError("MR 정보를 저장하지 못했어요.");
    setSub({ ...sub, songs: next });
  }

  function patch(i: number, p: Partial<Song>) {
    setSongs((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }

  async function checkViews(i: number) {
    const s = songs[i];
    if (!s.title.trim()) return;
    setChecking(i);
    setAutoNote("");
    try {
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: s.title, artist: s.artist }),
      });
      const d = await res.json();
      if (typeof d.views === "number") {
        patch(i, {
          level: levelFromViews(d.views),
          reason: `유튜브 조회수 약 ${Math.round(d.views / 10000).toLocaleString("ko-KR")}만회`,
        });
      } else if (d.reason === "no_key") {
        setAutoNote("조회수 자동 판정이 꺼져 있어요. 대중성은 직접 골라주세요.");
      } else if (d.reason === "not_found") {
        setAutoNote("유튜브에서 곡을 못 찾았어요. 직접 골라주세요.");
      } else {
        setAutoNote("조회수를 확인하지 못했어요. 직접 골라주세요.");
      }
    } catch {
      setAutoNote("조회수를 확인하지 못했어요. 직접 골라주세요.");
    }
    setChecking(null);
  }

  async function uploadInst(songIndex: number, file: File) {
    setUploading(songIndex);
    setError("");
    const safe = file.name.replace(/[^\w.-]/g, "_");
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    const { error: e } = await supabase.storage.from("busking-inst").upload(path, file);
    if (e) {
      setUploading(null);
      return setError("MR 파일을 올리지 못했어요.");
    }
    const { data } = supabase.storage.from("busking-inst").getPublicUrl(path);
    await saveInst(songIndex, data.publicUrl, file.name);
    setUploading(null);
  }

  /* ── 화면 ───────────────────────────────── */

  if (loading) {
    return (
      <main className="nr-page">
        <SubHeader title="버스킹 곡신청" />
        <div className="nr-card" style={{ height: 160, opacity: 0.55 }} />
      </main>
    );
  }

  if (!round) {
    return (
      <main className="nr-page">
        <SubHeader title="버스킹 곡신청" />
        <div className="nr-empty">
          진행 중인 버스킹이 없어요.
          <br />
          신청이 열리면 홈에 표시돼요.
        </div>
      </main>
    );
  }

  return (
    <main className="nr-page">
      <SubHeader title="버스킹 곡신청" />

      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      <div className="nr-card nr-card-tint mb-3 p-3.5">
        <p className="text-[14px] font-extrabold" style={{ color: "var(--ink)" }}>
          {round.title}
        </p>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--red-deep)" }}>
          {round.event_date ? `공연 ${round.event_date}` : ""}
          {round.deadline ? `${round.event_date ? " · " : ""}${fmtDeadline(round.deadline)} 마감` : ""}
        </p>
        {round.notice && (
          <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
            {round.notice}
          </p>
        )}
      </div>

      {/* 제출 후 상태 */}
      {step === "status" && sub && (
        <>
          {sub.status === "declined" ? (
            <div className="nr-card p-5 text-center">
              <p className="text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
                이번 버스킹은 쉬어가시는군요
              </p>
              {!closed && (
                <button onClick={() => setStep("rules")} className="nr-btn nr-btn-ghost mt-3 py-3">
                  역시 참여할래요
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="nr-card p-4">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
                    신청 완료
                  </p>
                  <span className="nr-badge nr-badge-live">{sub.songs.length}곡</span>
                </div>
                <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
                  {picked.length > 0
                    ? `${picked.length}곡이 선곡됐어요. MR을 올려주세요.`
                    : "운영자가 선곡하면 MR을 올리는 칸이 열려요."}
                </p>

                <div className="mt-3 flex flex-col gap-2">
                  {sub.songs.map((g, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3"
                      style={{
                        background: g.confirmed ? "var(--mint-bg)" : "var(--red-wash)",
                        border: g.confirmed ? "1px solid var(--mint)" : "1px solid transparent",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
                          {g.title}
                        </span>
                        {g.level && <span className="nr-badge nr-badge-tint">{g.level}</span>}
                        {g.confirmed && <span className="nr-badge nr-badge-live">선곡</span>}
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

                      {/* 선곡된 곡만 MR 업로드 */}
                      {g.confirmed && (
                        <div className="mt-2.5">
                          {g.instUrl ? (
                            <div className="flex items-center gap-2 rounded-lg bg-white p-2.5">
                              <span style={{ color: "var(--mint-text)" }}>
                                <Icon name="check" size={14} />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: "var(--ink)" }}>
                                {g.instName}
                              </span>
                              <label className="cursor-pointer text-[11px]" style={{ color: "var(--muted)" }}>
                                바꾸기
                                <input
                                  type="file"
                                  accept="audio/*"
                                  hidden
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) uploadInst(i, f);
                                  }}
                                />
                              </label>
                            </div>
                          ) : (
                            <label
                              className="flex cursor-pointer items-center justify-center rounded-lg bg-white py-2.5 text-[12.5px] font-bold"
                              style={{ border: "1px dashed var(--mint)", color: "var(--mint-text)" }}
                            >
                              {uploading === i ? "올리는 중..." : "MR 파일 올리기"}
                              <input
                                type="file"
                                accept="audio/*"
                                hidden
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadInst(i, f);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {!closed && (
                  <button onClick={() => setStep("songs")} className="nr-btn nr-btn-ghost mt-3 py-3">
                    신청곡 수정하기
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* 마감 후 새 신청 차단 */}
      {closed && !sub && (
        <div className="nr-empty">
          신청이 마감됐어요.
          {round.deadline && (
            <>
              <br />
              {fmtDeadline(round.deadline)} 마감
            </>
          )}
        </div>
      )}

      {/* 시작 */}
      {!closed && step === "intro" && !sub && (
        <div className="nr-card p-5">
          <p className="text-[17px] font-extrabold leading-snug" style={{ color: "var(--ink)" }}>
            우리 무대에 오를
            <br />곡을 신청해주세요
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            {meName} 님으로 신청돼요. 최소 {MIN_SONGS}곡을 적어주세요.
            <br />
            MR은 선곡된 뒤에 올리면 됩니다.
          </p>
          <button onClick={() => setStep("rules")} className="nr-btn nr-btn-primary mt-4">
            신청하기
          </button>
          <button onClick={() => save("declined", [])} disabled={busy} className="nr-btn nr-btn-ghost mt-2 py-3">
            이번엔 불참할게요
          </button>
        </div>
      )}

      {step === "rules" && (
        <div className="nr-card p-5">
          <p className="text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
            선곡 기준을 확인해주세요
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-relaxed" style={{ color: "#4a3f39" }}>
            <li>· 욕설이 들어간 곡은 안 돼요</li>
            <li>· 나만 아는 곡보다 대중성 높은 곡으로 골라주세요</li>
            <li>· 비긴어게인 버스킹 공연을 참고하시면 좋아요</li>
            <li>· 버스킹 점검은 정기모임에서 진행해요</li>
          </ul>
          <button onClick={() => setStep("experience")} className="nr-btn nr-btn-primary mt-4">
            내용 확인했어요
          </button>
        </div>
      )}

      {step === "experience" && (
        <div className="nr-card p-5">
          <p className="text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
            버스킹 경험이 있으세요?
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {(
              [
                ["first", "이번이 처음이에요"],
                ["experienced", "해본 적 있어요"],
              ] as ["first" | "experienced", string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setExperience(v)}
                className="rounded-xl px-4 py-3.5 text-left text-[14px]"
                style={
                  experience === v
                    ? { border: "1.5px solid var(--red)", background: "var(--red-wash)", fontWeight: 700 }
                    : { border: "1px solid var(--border)" }
                }
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setStep("songs")} disabled={!experience} className="nr-btn nr-btn-primary mt-4">
            다음
          </button>
        </div>
      )}

      {/* 곡 입력 — MR 없음 */}
      {step === "songs" && (
        <div className="flex flex-col gap-3">
          {autoNote && (
            <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              {autoNote}
            </p>
          )}

          {songs.map((s, i) => (
            <div key={i} className="nr-card p-4">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold" style={{ color: "var(--muted)" }}>
                  {i + 1}번째 곡
                </span>
                {songs.length > MIN_SONGS && (
                  <button
                    onClick={() => setSongs((c) => c.filter((_, idx) => idx !== i))}
                    className="ml-auto text-[11.5px]"
                    style={{ color: "var(--muted)" }}
                  >
                    이 곡 삭제
                  </button>
                )}
              </div>

              <input
                value={s.title}
                onChange={(e) => patch(i, { title: e.target.value })}
                onBlur={() => checkViews(i)}
                placeholder="곡 제목"
                className="nr-input mt-2"
              />
              <input
                value={s.artist}
                onChange={(e) => patch(i, { artist: e.target.value })}
                onBlur={() => checkViews(i)}
                placeholder="가수명 (선택)"
                className="nr-input mt-2"
              />

              <div className="mt-2 flex gap-1.5">
                {(["solo", "duet"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => patch(i, { type: t })}
                    className={"nr-btn-sm flex-1 " + (s.type === t ? "nr-btn-sm-solid" : "")}
                  >
                    {t === "solo" ? "솔로" : "듀엣"}
                  </button>
                ))}
              </div>

              {s.type === "duet" && (
                <input
                  value={s.partner}
                  onChange={(e) => patch(i, { partner: e.target.value })}
                  placeholder="함께 부를 크루원 이름"
                  className="nr-input mt-2"
                />
              )}

              <div className="mt-3">
                <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                  대중성 {checking === i && "· 확인 중..."}
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  {(["상", "중", "하"] as const).map((lv) => (
                    <button
                      key={lv}
                      onClick={() => patch(i, { level: lv })}
                      className={"nr-btn-sm flex-1 " + (s.level === lv ? "nr-btn-sm-solid" : "")}
                    >
                      {lv}
                    </button>
                  ))}
                </div>
                {s.reason && (
                  <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
                    {s.reason}
                  </p>
                )}
              </div>
            </div>
          ))}

          <button onClick={() => setSongs((c) => [...c, emptySong()])} className="nr-btn nr-btn-ghost py-3">
            <Icon name="plus" size={16} /> 곡 추가
          </button>

          <button
            onClick={() => save("submitted", songs)}
            disabled={busy || !canSubmit(songs)}
            className="nr-btn nr-btn-primary"
            style={canSubmit(songs) ? undefined : { opacity: 0.5 }}
          >
            {busy ? "제출 중..." : sub ? "수정 완료" : "제출하기"}
          </button>

          {!canSubmit(songs) && (
            <p className="text-center text-[11.5px]" style={{ color: "var(--muted)" }}>
              {songs.length < MIN_SONGS ? `최소 ${MIN_SONGS}곡이 필요해요` : "곡 제목을 채워주세요"}
            </p>
          )}
        </div>
      )}
    </main>
  );
}

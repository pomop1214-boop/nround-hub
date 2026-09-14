"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";
import {
  MIN_SONGS,
  canSubmit,
  emptySong,
  fmtDeadline,
  isClosed,
  levelFromViews,
  type BuskingConfig,
  type Song,
  type Submission,
} from "@/lib/busking";

const ME_KEY = "nround_me_v1";
const NAME_KEY = "nround_me_name";

type Step = "intro" | "rules" | "experience" | "songs" | "done" | "declined";

export default function BuskingPage() {
  const [cfg, setCfg] = useState<BuskingConfig | null>(null);
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

  const load = useCallback(async (id: string | null) => {
    setLoading(true);
    try {
      const [{ data: c }, { data: s }] = await Promise.all([
        supabase.from("busking_config").select("*").eq("id", 1).maybeSingle(),
        id
          ? supabase.from("busking_submissions").select("*").eq("member_id", id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setCfg((c ?? null) as BuskingConfig | null);
      const mine = (s ?? null) as Submission | null;
      setSub(mine);

      if (mine) {
        setExperience(mine.experience);
        setSongs(mine.songs?.length ? mine.songs : [emptySong(), emptySong()]);
        setStep(mine.status === "declined" ? "declined" : "done");
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

  const closed = isClosed(cfg);

  /* ── 저장 ───────────────────────────────── */

  async function save(status: "submitted" | "declined", nextSongs: Song[]) {
    if (!meId) return;
    setBusy(true);
    const payload = {
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
    if (e) {
      setError("제출하지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setError("");
    await load(meId);
    setStep(status === "declined" ? "declined" : "done");
  }

  /* ── 곡 편집 ────────────────────────────── */

  function patch(i: number, p: Partial<Song>) {
    setSongs((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }

  async function checkViews(i: number) {
    const s = songs[i];
    if (!s.title.trim()) return;
    setChecking(i);
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
      }
    } catch {
      /* 실패하면 직접 고르면 됩니다 */
    }
    setChecking(null);
  }

  async function uploadInst(i: number, file: File) {
    setUploading(i);
    setError("");
    const safe = file.name.replace(/[^\w.-]/g, "_");
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    const { error: e } = await supabase.storage.from("busking-inst").upload(path, file);
    if (e) {
      setUploading(null);
      setError("MR 파일을 올리지 못했어요.");
      return;
    }
    const { data } = supabase.storage.from("busking-inst").getPublicUrl(path);
    patch(i, { instUrl: data.publicUrl, instName: file.name });
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

  if (closed && !sub) {
    return (
      <main className="nr-page">
        <SubHeader title="버스킹 곡신청" />
        <div className="nr-empty">
          신청이 마감됐어요.
          {cfg?.deadline && (
            <>
              <br />
              {fmtDeadline(cfg.deadline)} 마감
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="nr-page">
      <SubHeader title="버스킹 곡신청" />

      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {cfg?.deadline && (
        <div className="nr-card nr-card-tint mb-3 flex items-center gap-2 p-3">
          <span style={{ color: "var(--red-deep)" }}>
            <Icon name="clock" size={15} />
          </span>
          <span className="text-[12.5px]" style={{ color: "var(--red-deep)" }}>
            {fmtDeadline(cfg.deadline)} 마감
          </span>
        </div>
      )}

      {cfg?.notice && (
        <p className="mb-3 whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {cfg.notice}
        </p>
      )}

      {/* 완료 / 불참 */}
      {step === "done" && sub && (
        <div className="nr-card p-4">
          <p className="text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
            신청이 접수됐어요
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>
            {sub.songs.length}곡 · {sub.experience === "first" ? "첫 참여" : "경험 있음"}
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {sub.songs.map((s, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: "var(--red-wash)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
                    {s.title}
                  </span>
                  {s.level && <span className="nr-badge nr-badge-tint">{s.level}</span>}
                  <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>
                    {s.type === "duet" ? "듀엣" : "솔로"}
                  </span>
                </div>
                {s.artist && (
                  <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                    {s.artist}
                    {s.partner ? ` · ${s.partner} 님과` : ""}
                  </p>
                )}
                {s.instName && (
                  <p className="mt-1 truncate text-[11px]" style={{ color: "var(--muted)" }}>
                    MR · {s.instName}
                  </p>
                )}
              </div>
            ))}
          </div>

          {!closed && (
            <button onClick={() => setStep("songs")} className="nr-btn nr-btn-ghost mt-3 py-3">
              수정하기
            </button>
          )}
        </div>
      )}

      {step === "declined" && (
        <div className="nr-card p-5 text-center">
          <p className="text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
            이번 버스킹은 쉬어가시는군요
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--muted)" }}>
            다음에 함께해요.
          </p>
          {!closed && (
            <button onClick={() => setStep("rules")} className="nr-btn nr-btn-ghost mt-3 py-3">
              역시 참여할래요
            </button>
          )}
        </div>
      )}

      {/* 시작 */}
      {step === "intro" && (
        <div className="nr-card p-5">
          <p className="text-[17px] font-extrabold leading-snug" style={{ color: "var(--ink)" }}>
            우리 무대에 오를
            <br />곡을 신청해주세요
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            {meName} 님으로 신청돼요. 최소 {MIN_SONGS}곡을 MR과 함께 올려주세요.
          </p>
          <button onClick={() => setStep("rules")} className="nr-btn nr-btn-primary mt-4">
            신청하기
          </button>
          <button
            onClick={() => save("declined", [])}
            disabled={busy}
            className="nr-btn nr-btn-ghost mt-2 py-3"
          >
            이번엔 불참할게요
          </button>
        </div>
      )}

      {/* 선곡 기준 */}
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

      {/* 경험 */}
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
          <button
            onClick={() => setStep("songs")}
            disabled={!experience}
            className="nr-btn nr-btn-primary mt-4"
          >
            다음
          </button>
        </div>
      )}

      {/* 곡 입력 */}
      {step === "songs" && (
        <div className="flex flex-col gap-3">
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

              <div className="mt-3">
                <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                  MR 파일
                </p>
                {s.instUrl ? (
                  <div
                    className="mt-1.5 flex items-center gap-2 rounded-xl p-2.5"
                    style={{ background: "var(--mint-bg)", border: "1px solid var(--mint)" }}
                  >
                    <Icon name="check" size={14} />
                    <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--mint-text)" }}>
                      {s.instName}
                    </span>
                    <button
                      onClick={() => patch(i, { instUrl: null, instName: "" })}
                      className="text-[11px]"
                      style={{ color: "var(--mint-text)" }}
                    >
                      바꾸기
                    </button>
                  </div>
                ) : (
                  <label
                    className="mt-1.5 flex cursor-pointer items-center justify-center rounded-xl py-3 text-[12.5px]"
                    style={{ border: "1px dashed var(--red-tint)", background: "var(--red-wash)", color: "var(--red-deep)" }}
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
              {songs.length < MIN_SONGS
                ? `최소 ${MIN_SONGS}곡이 필요해요`
                : "곡 제목과 MR 파일을 모두 채워주세요"}
            </p>
          )}
        </div>
      )}
    </main>
  );
}

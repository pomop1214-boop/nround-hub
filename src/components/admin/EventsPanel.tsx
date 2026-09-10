"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  place: string | null;
  memo: string | null;
};

const WD = ["일", "월", "화", "수", "목", "금", "토"];

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]}) ${String(d.getHours()).padStart(
    2,
    "0"
  )}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function EventsPanel() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [place, setPlace] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("events").select("*").order("starts_at");
    setEvents((data ?? []) as EventRow[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("일정 이름을 입력해주세요.");
    if (!start) return setError("시작 일시를 정해주세요.");
    setBusy(true);
    const { error: e2 } = await supabase.from("events").insert({
      title: title.trim(),
      starts_at: new Date(start).toISOString(),
      ends_at: end ? new Date(end).toISOString() : null,
      place: place.trim() || null,
    });
    setBusy(false);
    if (e2) return setError("만들지 못했어요.");
    setError("");
    setTitle("");
    setStart("");
    setEnd("");
    setPlace("");
    load();
  }

  async function remove(ev: EventRow) {
    if (!confirm(`"${ev.title}" 일정을 지울까요?`)) return;
    await supabase.from("events").delete().eq("id", ev.id);
    load();
  }

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = events.filter((e) => new Date(e.starts_at).getTime() < now).reverse();

  return (
    <section>
      <form onSubmit={create} className="nr-card flex flex-col gap-2 p-3.5">
        <p className="nr-h2">새 일정 만들기</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="일정 이름 (예: 주간 정기 연습)"
          className="nr-input"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[11.5px]" style={{ color: "var(--muted)" }}>
            시작
          </label>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="nr-input"
          />
          <label className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
            종료 (선택)
          </label>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="nr-input"
          />
        </div>
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="장소 (예: 스튜디오 A)"
          className="nr-input"
        />
        {error && <p className="text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}
        <button type="submit" disabled={busy} className="nr-btn nr-btn-primary py-3">
          등록
        </button>
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
          일정은 알림용이라 참석 응답은 받지 않아요. 참석을 물어보려면 투표를 만들어주세요.
        </p>
      </form>

      <p className="nr-h2 mt-5">다가오는 일정 {upcoming.length}개</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {upcoming.map((ev) => (
          <div key={ev.id} className="nr-card flex items-center gap-2 p-3">
            <div className="flex-1">
              <p className="text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
                {ev.title}
              </p>
              <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                {fmt(ev.starts_at)}
                {ev.place ? ` · ${ev.place}` : ""}
              </p>
            </div>
            <button
              onClick={() => remove(ev)}
              className="nr-btn-sm"
              style={{ borderColor: "transparent", background: "transparent" }}
            >
              삭제
            </button>
          </div>
        ))}
        {upcoming.length === 0 && <p className="nr-empty">예정된 일정이 없어요.</p>}
      </div>

      {past.length > 0 && (
        <>
          <p className="nr-h2 mt-5">지난 일정</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {past.slice(0, 6).map((ev) => (
              <div key={ev.id} className="nr-card flex items-center gap-2 p-3" style={{ opacity: 0.6 }}>
                <div className="flex-1">
                  <p className="text-[13px]" style={{ color: "var(--ink)" }}>{ev.title}</p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                    {fmt(ev.starts_at)}
                  </p>
                </div>
                <button
                  onClick={() => remove(ev)}
                  className="nr-btn-sm"
                  style={{ borderColor: "transparent", background: "transparent" }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

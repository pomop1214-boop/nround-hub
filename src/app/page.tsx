import Link from "next/link";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";
import Hero from "@/components/Hero";
import PushSubscribeButton from "@/components/PushSubscribeButton";
import InstallButton from "@/components/InstallButton";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";
import EventList, { type EventRow } from "@/components/EventList";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

export const revalidate = 0;

function mmdd(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function daysLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "마감";
  const d = Math.ceil(diff / 86400000);
  return `${d}일 남음`;
}

export default async function HomePage() {
  const session = readSession(cookies().get(SESSION_COOKIE)?.value);

  const nowIso = new Date().toISOString();
  const [{ data: announcements }, { data: votes }, { data: events }] = await Promise.all([
    supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(4),
    supabase
      .from("votes")
      .select("id, title, deadline, category")
      .eq("is_open", true)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, place")
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(2),
  ]);

  // 버스킹은 진행 중인 회차가 있을 때만 홈에 띄웁니다.
  const { data: buskingRound } = await supabase
    .from("busking_rounds")
    .select("id, title, event_date, deadline")
    .eq("is_open", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const upcoming = (events ?? []) as EventRow[];

  const notices = announcements ?? [];
  const openVotes = votes ?? [];

  // 투표별 참여 인원
  const voteIds = openVotes.map((v) => v.id);
  const { data: responses } = voteIds.length
    ? await supabase.from("vote_responses").select("vote_id").in("vote_id", voteIds)
    : { data: [] };
  const countFor = (id: string) => (responses ?? []).filter((r) => r.vote_id === id).length;

  return (
    <main className="nr-page">
      <AppHeader name={session?.name} />

      <Hero />

      <div className="mt-4 flex flex-col gap-2">
        <PushSubscribeButton />
        <InstallButton />
      </div>

      {/* 다가오는 일정 */}
      {upcoming.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="nr-h2">다가오는 일정</h2>
            <Link href="/me" className="nr-more">전체보기 ›</Link>
          </div>
          <div className="mt-2.5">
            <EventList events={upcoming} />
          </div>
        </section>
      )}

      {/* 버스킹 — 진행 중일 때만 */}
      {buskingRound && (
        <section className="mt-6">
          <h2 className="nr-h2">버스킹 곡신청</h2>
          <Link href="/busking" className="nr-card nr-card-tint mt-2.5 flex items-center gap-3 p-4">
            <span className="nr-iconbox">
              <Icon name="mic" size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold" style={{ color: "var(--ink)" }}>
                {buskingRound.title}
              </span>
              <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--muted)" }}>
                {buskingRound.deadline
                  ? `${daysLeft(buskingRound.deadline)} · 신청받는 중`
                  : "신청받는 중"}
              </span>
            </span>
            <span style={{ color: "var(--muted)" }}>
              <Icon name="chevron" size={16} />
            </span>
          </Link>
        </section>
      )}

      {/* 진행 중인 투표 */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="nr-h2">진행 중인 투표</h2>
          <Link href="/vote" className="nr-more">전체보기 ›</Link>
        </div>

        <div className="mt-2.5 flex flex-col gap-2">
          {openVotes.length === 0 ? (
            <p className="nr-empty">진행 중인 투표가 없어요.</p>
          ) : (
            openVotes.map((v) => (
              <Link key={v.id} href="/vote" className="nr-card flex items-center gap-3 p-3.5">
                <span className="nr-iconbox">
                  <Icon name="music" size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold" style={{ color: "var(--ink)" }}>
                    {v.title}
                  </span>
                  <span className="mt-1 block text-[11.5px]" style={{ color: "var(--muted)" }}>
                    {[v.deadline ? daysLeft(v.deadline) : v.category, `${countFor(v.id)}명 참여`].join(" · ")}
                  </span>
                </span>
                <span style={{ color: "var(--muted)" }}>
                  <Icon name="chevron" size={16} />
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* 공지사항 */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="nr-h2">최근 공지</h2>
          <Link href="/notices" className="nr-more">전체보기 ›</Link>
        </div>

        <div className="mt-2 flex flex-col">
          {notices.length === 0 ? (
            <p className="nr-empty mt-1">아직 올라온 공지가 없어요.</p>
          ) : (
            notices.map((a) => (
              <div key={a.id} className="flex items-center gap-2.5 py-2.5">
                <span
                  className="h-[5px] w-[5px] shrink-0 rounded-full"
                  style={{ background: "var(--red)" }}
                />
                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--ink)" }}>
                  {a.title}
                </span>
                <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                  {mmdd(a.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <LogoutButton />
    </main>
  );
}

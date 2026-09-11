"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";
import EventList, { type EventRow } from "@/components/EventList";

const ME_KEY = "nround_me_v1";
const ACCOUNT = { bank: "카카오뱅크", number: "3333315776031", label: "N.ROUND 모임통장" };

type Member = { id: string; name: string; member_type: string; role: string | null };

function roleLabel(role: string | null) {
  if (role === "lead") return "운영장";
  if (role === "sub_lead") return "부운영장";
  if (role === "supporter") return "서포터즈";
  return null;
}
type Period = {
  id: string;
  label: string;
  amount: number;
  due_date: string | null;
  guest_dues_enabled: boolean;
  guest_amount: number;
};
type Payment = { paid: boolean; claimed_at: string | null; visit_count: number };
type Vote = { id: string; title: string; deadline: string | null };
type MyResponse = { vote_id: string; choice: string };
type Rule = { id: string; version: number; requires_ack: boolean };

function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export default function MyPage() {
  const router = useRouter();
  const [me, setMe] = useState<Member | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [myChoices, setMyChoices] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rulesTodo, setRulesTodo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const meId = localStorage.getItem(ME_KEY);
    if (!meId) {
      setLoading(false);
      return;
    }
    try {
      const [{ data: m }, { data: ps }, { data: vs }, { data: evs }] = await Promise.all([
        supabase.from("crew_members").select("id, name, member_type, role").eq("id", meId).maybeSingle(),
        supabase
          .from("dues_periods")
          .select("*")
          .eq("is_current", true)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("votes")
          .select("id, title, deadline")
          .eq("is_open", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("events")
          .select("id, title, starts_at, ends_at, place")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(8),
      ]);

      setEvents((evs ?? []) as EventRow[]);

      setMe((m ?? null) as Member | null);
      const cur = (ps ?? [])[0] ?? null;
      setPeriod(cur);
      setVotes((vs ?? []) as Vote[]);

      if (cur) {
        const { data: pay } = await supabase
          .from("dues_payments")
          .select("paid, claimed_at, visit_count")
          .eq("period_id", cur.id)
          .eq("member_id", meId)
          .maybeSingle();
        setPayment((pay ?? null) as Payment | null);
      }

      const ids = (vs ?? []).map((v) => v.id);
      if (ids.length) {
        const { data: rs } = await supabase
          .from("vote_responses")
          .select("vote_id, choice")
          .eq("member_id", meId)
          .in("vote_id", ids);
        const map: Record<string, string> = {};
        (rs ?? []).forEach((r) => {
          map[r.vote_id] = r.choice;
        });
        setMyChoices(map);
      }

      // 확인이 필요한 규정 개수
      const [{ data: allRules }, { data: targets }, { data: acks }] = await Promise.all([
        supabase.from("rules").select("id, version, requires_ack").eq("is_published", true),
        supabase.from("rule_targets").select("rule_id, member_id"),
        supabase.from("rule_acks").select("rule_id, version").eq("member_id", meId),
      ]);
      const mine = ((allRules ?? []) as Rule[]).filter((r) => {
        if (!r.requires_ack) return false;
        const tg = (targets ?? []).filter((t) => t.rule_id === r.id);
        if (tg.length > 0 && !tg.some((t) => t.member_id === meId)) return false;
        return !(acks ?? []).some((a) => a.rule_id === r.id && a.version === r.version);
      });
      setRulesTodo(mine.length);
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function claim() {
    if (!period || !me) return;
    const stamp = new Date().toISOString();
    setPayment({ paid: false, claimed_at: stamp, visit_count: payment?.visit_count ?? 0 });
    const { error: e } = await supabase.from("dues_payments").upsert(
      { period_id: period.id, member_id: me.id, paid: false, claimed_at: stamp },
      { onConflict: "period_id,member_id" }
    );
    if (e) setError("전달하지 못했어요.");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    localStorage.removeItem(ME_KEY);
    localStorage.removeItem("nround_me_name");
    router.replace("/login");
    router.refresh();
  }

  const isGuest = me?.member_type === "guest";
  const exempt = isGuest && !(period?.guest_dues_enabled ?? false);
  const visits = payment?.visit_count ?? 0;
  const owed = !period ? 0 : isGuest ? visits * period.guest_amount : period.amount;
  const paid = !!payment?.paid;
  const claimed = !paid && !!payment?.claimed_at;

  const notVoted = votes.filter((v) => !myChoices[v.id]);

  if (loading) {
    return (
      <main className="nr-page">
        <SubHeader title="마이" />
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="nr-card" style={{ height: 70, opacity: 0.55 }} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="nr-page">
      <SubHeader title="마이" />

      {error && <p className="text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {/* 내 프로필 */}
      <div className="nr-card flex items-center gap-3 p-4">
        <span
          className="grid h-12 w-12 place-items-center rounded-full text-[17px] font-extrabold"
          style={{ background: "var(--red-tint)", color: "var(--red-deep)" }}
        >
          {me?.name?.slice(0, 1) ?? "?"}
        </span>
        <div className="flex-1">
          <p className="text-[16px] font-extrabold" style={{ color: "var(--ink)" }}>
            {me?.name ?? "이름 없음"}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              {isGuest ? "비회원" : "회원"}
            </span>
            {roleLabel(me?.role ?? null) && (
              <span className="nr-badge nr-badge-red flex items-center gap-1">
                <Icon name="crown" size={11} />
                {roleLabel(me?.role ?? null)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 할 일 요약 */}
      {(notVoted.length > 0 || rulesTodo > 0 || (!paid && !exempt && owed > 0)) && (
        <div className="nr-card nr-card-tint mt-3 flex items-start gap-3 p-4">
          <span style={{ color: "var(--red)" }}>
            <Icon name="alert" size={18} />
          </span>
          <div className="text-[13px] leading-relaxed" style={{ color: "var(--red-deep)" }}>
            <b>아직 남은 게 있어요</b>
            <br />
            {[
              notVoted.length > 0 ? `투표 ${notVoted.length}개` : null,
              rulesTodo > 0 ? `규정 확인 ${rulesTodo}개` : null,
              !paid && !exempt && owed > 0 ? "회비 미납" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      )}

      {/* 다가오는 일정 */}
      <section className="mt-6">
        <h2 className="nr-h2">다가오는 일정</h2>
        <div className="mt-2.5">
          {events.length === 0 ? (
            <p className="nr-empty">예정된 일정이 없어요.</p>
          ) : (
            <EventList events={events} />
          )}
        </div>
      </section>

      {/* 회비 */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="nr-h2">회비 납부</h2>
          {period && (
            <span className="nr-more">{period.label}</span>
          )}
        </div>

        {!period ? (
          <p className="nr-empty mt-2.5">이번 회차가 아직 없어요.</p>
        ) : exempt ? (
          <div className="nr-card mt-2.5 p-4">
            <p className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>
              이번 회차는 회비가 없어요
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
              비회원은 이번 회차에 회비를 받지 않아요.
            </p>
          </div>
        ) : (
          <div className="nr-card mt-2.5 p-4">
            <div className="flex items-center gap-2">
              <span
                className="nr-badge"
                style={
                  paid
                    ? { background: "var(--mint)", color: "#1F6B73" }
                    : claimed
                    ? { background: "#FFF6E8", color: "#9A5B2E" }
                    : { background: "var(--red)", color: "#fff" }
                }
              >
                {paid ? "납부 완료" : claimed ? "확인 대기중" : "미납"}
              </span>
              <span className="ml-auto text-[17px] font-extrabold" style={{ color: "var(--ink)" }}>
                {won(owed)}
              </span>
            </div>
            {isGuest && (
              <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
                {visits}회 참여 · {won(period.guest_amount)} × {visits}
              </p>
            )}
            {period.due_date && !paid && (
              <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
                {period.due_date} 까지
              </p>
            )}

            {!paid && owed > 0 && (
              <>
                <div
                  className="mt-3 rounded-xl p-3"
                  style={{ background: "var(--red-wash)", border: "1px solid var(--red-tint)" }}
                >
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                    {ACCOUNT.bank} · {ACCOUNT.label}
                  </p>
                  <p className="mt-0.5 text-[16px] font-bold" style={{ color: "var(--ink)" }}>
                    {ACCOUNT.number}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(ACCOUNT.number).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      });
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold"
                    style={{ background: "#fff", border: "1px solid var(--red-tint)", color: "var(--red-deep)" }}
                  >
                    <Icon name={copied ? "check" : "copy"} size={14} />
                    {copied ? "복사했어요" : "계좌번호 복사"}
                  </button>
                </div>

                {claimed ? (
                  <p className="mt-3 text-center text-[12px]" style={{ color: "var(--muted)" }}>
                    운영자 확인을 기다리는 중이에요.
                  </p>
                ) : (
                  <button onClick={claim} className="nr-btn nr-btn-primary mt-3">
                    보냈어요
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* 투표 */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="nr-h2">내 투표</h2>
          <Link href="/vote" className="nr-more">전체보기 ›</Link>
        </div>

        <div className="mt-2.5 flex flex-col gap-2">
          {votes.length === 0 ? (
            <p className="nr-empty">진행 중인 투표가 없어요.</p>
          ) : (
            votes.map((v) => {
              const choice = myChoices[v.id];
              return (
                <Link key={v.id} href="/vote" className="nr-card flex items-center gap-3 p-3.5">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                    style={{
                      background: choice ? "var(--mint)" : "var(--red-tint)",
                      color: choice ? "#1F6B73" : "var(--red)",
                    }}
                  >
                    <Icon name={choice ? "check" : "alert"} size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[13.5px] font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {v.title}
                    </span>
                    <span
                      className="mt-0.5 block truncate text-[11.5px]"
                      style={{ color: choice ? "var(--muted)" : "var(--red)" }}
                    >
                      {choice ? `내 선택 · ${choice}` : "아직 응답하지 않았어요"}
                    </span>
                  </span>
                  <span style={{ color: "var(--muted)" }}>
                    <Icon name="chevron" size={16} />
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {/* 규정 */}
      <section className="mt-6">
        <h2 className="nr-h2">규정 확인</h2>
        <Link href="/rules" className="nr-card mt-2.5 flex items-center gap-3 p-4">
          <span className="nr-iconbox">
            <Icon name="doc" size={18} />
          </span>
          <span className="flex-1 text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
            {rulesTodo > 0 ? `확인이 필요한 규정 ${rulesTodo}개` : "모두 확인했어요"}
          </span>
          <span style={{ color: "var(--muted)" }}>
            <Icon name="chevron" size={16} />
          </span>
        </Link>
      </section>

      <div className="mt-8 flex items-center justify-center gap-4">
        <Link href="/password" className="text-[12px]" style={{ color: "var(--muted)" }}>
          비밀번호 변경
        </Link>
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          <Icon name="settings" size={13} />
          관리자
        </Link>
        <button onClick={logout} className="text-[12px]" style={{ color: "var(--muted)" }}>
          로그아웃
        </button>
      </div>
    </main>
  );
}

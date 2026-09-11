"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "1214";
const ME_KEY = "nround_me_v1";
const ACCOUNT = { bank: "카카오뱅크", number: "3333315776031", label: "N.ROUND 모임통장" };

type Member = { id: string; name: string; active: boolean; member_type: string };
type Period = {
  id: string;
  label: string;
  amount: number;
  due_date: string | null;
  guest_dues_enabled: boolean;
  guest_amount: number;
};
type Payment = {
  member_id: string;
  paid: boolean;
  paid_at: string | null;
  claimed_at: string | null;
  visit_count: number;
};

function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function AccountCard() {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(ACCOUNT.number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="nr-card mt-4 p-4">
      <p className="nr-h2">모임 계좌</p>
      <p className="mt-2 text-[12.5px]" style={{ color: "var(--muted)" }}>
        {ACCOUNT.bank} · {ACCOUNT.label}
      </p>
      <p className="mt-0.5 text-[19px] font-bold" style={{ color: "var(--ink)" }}>{ACCOUNT.number}</p>
      <button
        onClick={copy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13.5px] font-bold"
        style={
          copied
            ? { background: "var(--mint-bg)", border: "1px solid var(--mint)", color: "var(--mint-text)" }
            : { background: "var(--red-wash)", border: "1px solid var(--red-tint)", color: "var(--red-deep)" }
        }
      >
        <Icon name={copied ? "check" : "copy"} size={15} />
        {copied ? "계좌번호를 복사했어요" : "계좌번호 복사"}
      </button>
    </div>
  );
}

export default function DuesPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [period, setPeriod] = useState<Period | null>(null);
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [meId, setMeId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // 관리자 화면에서 한 번 확인했으면 여기서도 바로 열어줍니다.
  useEffect(() => {
    if (localStorage.getItem("nround-admin-unlocked") === "1") setIsAdmin(true);
  }, []);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ms }, { data: ps }] = await Promise.all([
        supabase.from("crew_members").select("*").eq("active", true).order("name"),
        supabase
          .from("dues_periods")
          .select("*")
          .eq("is_current", true)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const current = (ps ?? [])[0] ?? null;
      setMembers((ms ?? []) as Member[]);
      setPeriod(current);

      if (current) {
        const { data: pay } = await supabase
          .from("dues_payments")
          .select("member_id, paid, paid_at, claimed_at, visit_count")
          .eq("period_id", current.id);
        const map: Record<string, Payment> = {};
        (pay ?? []).forEach((p) => {
          map[p.member_id] = p as Payment;
        });
        setPayments(map);
      }
      setError("");
    } catch {
      setError("불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setMeId(localStorage.getItem(ME_KEY));
    load();
  }, [load]);

  function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setIsAdmin(true);
      setPinOpen(false);
      setPin("");
      setPinError("");
      localStorage.setItem("nround-admin-unlocked", "1");
      localStorage.setItem("nround-admin-pin", pin);
    } else setPinError("PIN이 맞지 않아요.");
  }

  const isGuest = (m: Member) => m.member_type === "guest";

  // 비회원 참여비를 안 받는 회차면 비회원은 회비 명단에서 아예 빠집니다.
  const billed = members.filter((m) => !isGuest(m) || (period?.guest_dues_enabled ?? false));

  function amountFor(m: Member) {
    if (!period) return 0;
    if (!isGuest(m)) return period.amount;
    return (payments[m.id]?.visit_count ?? 0) * period.guest_amount;
  }

  async function toggle(memberId: string) {
    if (!period || !isAdmin) return;
    const next = !payments[memberId]?.paid;
    const prev = payments;
    setPayments({
      ...payments,
      [memberId]: {
        member_id: memberId,
        paid: next,
        paid_at: next ? new Date().toISOString() : null,
        claimed_at: null,
        visit_count: payments[memberId]?.visit_count ?? 0,
      },
    });
    const { error: upErr } = await supabase.from("dues_payments").upsert(
      {
        period_id: period.id,
        member_id: memberId,
        paid: next,
        paid_at: next ? new Date().toISOString() : null,
        claimed_at: null,
      },
      { onConflict: "period_id,member_id" }
    );
    if (upErr) {
      setPayments(prev);
      setError("저장에 실패했어요.");
    }
  }

  async function claim() {
    if (!period || !meId) return;
    const stamp = new Date().toISOString();
    setPayments({
      ...payments,
      [meId]: {
        member_id: meId,
        paid: false,
        paid_at: null,
        claimed_at: stamp,
        visit_count: payments[meId]?.visit_count ?? 0,
      },
    });
    const { error: e } = await supabase.from("dues_payments").upsert(
      { period_id: period.id, member_id: meId, paid: false, claimed_at: stamp },
      { onConflict: "period_id,member_id" }
    );
    if (e) setError("전달하지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  async function reject(memberId: string) {
    if (!period) return;
    setPayments({
      ...payments,
      [memberId]: {
        member_id: memberId,
        paid: false,
        paid_at: null,
        claimed_at: null,
        visit_count: payments[memberId]?.visit_count ?? 0,
      },
    });
    await supabase.from("dues_payments").upsert(
      { period_id: period.id, member_id: memberId, paid: false, claimed_at: null },
      { onConflict: "period_id,member_id" }
    );
  }

  async function setVisits(memberId: string, next: number) {
    if (!period || next < 0) return;
    const cur = payments[memberId];
    setPayments({
      ...payments,
      [memberId]: {
        member_id: memberId,
        paid: cur?.paid ?? false,
        paid_at: cur?.paid_at ?? null,
        claimed_at: cur?.claimed_at ?? null,
        visit_count: next,
      },
    });
    await supabase.from("dues_payments").upsert(
      { period_id: period.id, member_id: memberId, visit_count: next },
      { onConflict: "period_id,member_id" }
    );
  }

  const paidCount = billed.filter((m) => payments[m.id]?.paid).length;
  const pendingClaims = billed.filter((m) => !payments[m.id]?.paid && payments[m.id]?.claimed_at);

  const me = members.find((m) => m.id === meId) ?? null;
  const iPaid = me ? !!payments[me.id]?.paid : false;
  const iClaimed = me ? !iPaid && !!payments[me.id]?.claimed_at : false;
  const meIsGuest = me ? me.member_type === "guest" : false;
  const meExempt = meIsGuest && !(period?.guest_dues_enabled ?? false);
  const meVisits = me ? payments[me.id]?.visit_count ?? 0 : 0;
  const meOwed = me ? amountFor(me) : 0;

  if (loading) {
    return (
      <main className="nr-page">
        <SubHeader title="회비 입금 확인" />
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="nr-card" style={{ height: 62, opacity: 0.55 }} />
          ))}
        </div>
      </main>
    );
  }

  if (!period) {
    return (
      <main className="nr-page">
        <SubHeader title="회비 입금 확인" />
        <div className="nr-empty">
          이번 회차가 아직 없어요.
          <br />
          관리자 화면에서 이번 달 회비를 등록해주세요.
        </div>
      </main>
    );
  }

  return (
    <main className="nr-page">
      <SubHeader
        title="회비 입금 확인"
        right={
          !isAdmin ? (
            <button onClick={() => setPinOpen((v) => !v)} className="nr-btn-sm">운영자</button>
          ) : undefined
        }
      />

      {error && <p className="text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {pinOpen && !isAdmin && (
        <form onSubmit={submitPin} className="mt-3 flex gap-2">
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
      {pinError && <p className="mt-1.5 text-[12px]" style={{ color: "var(--red-deep)" }}>{pinError}</p>}

      {isAdmin ? (
        <>
          <div
            className="mt-4 flex items-center justify-between rounded-[14px] px-4 py-3.5"
            style={{ background: "var(--mint-bg)", border: "1px solid var(--mint)" }}
          >
            <span className="text-[14px] font-bold" style={{ color: "var(--mint-text)" }}>
              {paidCount} / {billed.length}명 납부
            </span>
            <span className="text-[14px] font-bold" style={{ color: "var(--mint-text)" }}>
              {won(billed.filter((m) => payments[m.id]?.paid).reduce((sum, m) => sum + amountFor(m), 0))}
            </span>
          </div>

          {pendingClaims.length > 0 && (
            <div className="mt-5">
              <p className="nr-h2">확인 대기 {pendingClaims.length}건</p>
              <div className="mt-2 flex flex-col gap-2">
                {pendingClaims.map((m) => (
                  <div key={m.id} className="nr-card nr-card-tint p-3.5">
                    <div className="flex items-center gap-2">
                      <span style={{ color: "#9A5B2E" }}>
                        <Icon name="clock" size={16} />
                      </span>
                      <span className="flex-1 text-[14.5px] font-bold" style={{ color: "var(--ink)" }}>
                        {m.name}
                      </span>
                      <span className="text-[11.5px]" style={{ color: "#9A5B2E" }}>
                        보냈다고 함
                      </span>
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <button onClick={() => reject(m.id)} className="nr-btn-sm flex-1 py-2">
                        아직 안 들어옴
                      </button>
                      <button onClick={() => toggle(m.id)} className="nr-btn-sm nr-btn-sm-solid flex-1 py-2">
                        확인, 납부 완료
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="nr-h2 mt-5">이름을 눌러 체크</p>
          <div className="mt-2 flex flex-col gap-2">
            {billed.map((m) => {
              const paid = !!payments[m.id]?.paid;
              const guest = isGuest(m);
              const visits = payments[m.id]?.visit_count ?? 0;
              return (
                <div key={m.id} className={"nr-card p-3.5 " + (paid ? "nr-card-tint" : "")}>
                  <button onClick={() => toggle(m.id)} className="flex w-full items-center gap-3 text-left">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                      style={{
                        background: paid ? "var(--mint)" : "#F4EAE6",
                        color: paid ? "var(--mint-text)" : "transparent",
                      }}
                    >
                      <Icon name="check" size={14} />
                    </span>
                    <span className="flex flex-1 items-center gap-1.5">
                      <span className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>{m.name}</span>
                      {guest && <span className="nr-badge nr-badge-tint">비회원</span>}
                    </span>
                    <span
                      className="text-[11.5px] font-semibold"
                      style={{ color: paid ? "var(--mint-text)" : "var(--muted)" }}
                    >
                      {paid ? "입금 완료" : won(amountFor(m))}
                    </span>
                  </button>

                  {guest && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>참여 횟수</span>
                      <button onClick={() => setVisits(m.id, visits - 1)} className="nr-btn-sm" style={{ minWidth: 30 }}>
                        −
                      </button>
                      <span
                        className="text-[14px] font-bold"
                        style={{ color: "var(--ink)", minWidth: 18, textAlign: "center" }}
                      >
                        {visits}
                      </span>
                      <button onClick={() => setVisits(m.id, visits + 1)} className="nr-btn-sm" style={{ minWidth: 30 }}>
                        +
                      </button>
                      <span className="ml-auto text-[11.5px]" style={{ color: "var(--muted)" }}>
                        × {won(period.guest_amount)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        me &&
        (meExempt || (meIsGuest && meVisits === 0 && !iPaid && !iClaimed) ? (
          <div className="nr-card mt-4 p-6 text-center">
            <p className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>
              {meExempt ? "이번 회차는 회비가 없어요" : "이번 달 참여 기록이 없어요"}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
              {meExempt
                ? "비회원은 이번 회차에 회비를 받지 않아요."
                : "참여하시면 운영자가 횟수를 기록하고, 그만큼만 내시면 돼요."}
            </p>
          </div>
        ) : (
          <>
            <AccountCard />
            <div
              className="mt-3 rounded-3xl px-6 py-9 text-center"
              style={
                iPaid
                  ? { background: "var(--mint-bg)", border: "1px solid var(--mint)" }
                  : iClaimed
                  ? { background: "#FFF6E8", border: "1px solid #F6DCBE" }
                  : { background: "linear-gradient(165deg,#F4604D,#E0492F)" }
              }
            >
              <p
                className="text-[12.5px] font-semibold"
                style={{ color: iPaid ? "var(--mint-text)" : iClaimed ? "#9A5B2E" : "rgba(255,255,255,.85)" }}
              >
                {me.name} 님
              </p>
              <p
                className="nr-wordmark mt-2.5"
                style={{
                  fontSize: 34,
                  color: iPaid ? "var(--mint-text)" : iClaimed ? "#9A5B2E" : "#fff",
                }}
              >
                {iPaid ? "입금 완료" : iClaimed ? "확인 대기중" : meIsGuest ? won(meOwed) : "미납"}
              </p>
              <p
                className="mt-3 text-[13.5px] leading-relaxed"
                style={{ color: iPaid ? "var(--mint-text)" : iClaimed ? "#9A5B2E" : "rgba(255,255,255,.9)" }}
              >
                {iPaid
                  ? "확인됐어요. 고마워요!"
                  : iClaimed
                  ? "운영자가 확인하면 완료로 바뀌어요"
                  : meIsGuest
                  ? `${meVisits}회 참여 · ${won(period.guest_amount)} × ${meVisits}`
                  : `${won(period.amount)}을 위 계좌로 보내주세요`}
              </p>
            </div>

            {!iPaid &&
              (iClaimed ? (
                <p className="mt-3 text-center text-[12px]" style={{ color: "var(--muted)" }}>
                  운영자 확인을 기다리는 중이에요.
                </p>
              ) : (
                <button onClick={claim} className="nr-btn nr-btn-primary mt-3">보냈어요</button>
              ))}
          </>
        ))
      )}
    </main>
  );
}

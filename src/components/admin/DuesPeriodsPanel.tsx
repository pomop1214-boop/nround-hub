"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Period = {
  id: string;
  label: string;
  amount: number;
  due_date: string | null;
  is_current: boolean;
  guest_dues_enabled: boolean;
  guest_amount: number;
};

function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function defaultLabel() {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 회비`;
}

export default function DuesPeriodsPanel() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [label, setLabel] = useState(defaultLabel());
  const [amount, setAmount] = useState("20000");
  const [dueDate, setDueDate] = useState("");
  const [guestOn, setGuestOn] = useState(false);
  const [guestAmount, setGuestAmount] = useState("5000");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("dues_periods")
      .select("*")
      .order("created_at", { ascending: false });
    setPeriods((data ?? []) as Period[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!label.trim()) return setError("회차 이름을 입력해주세요.");
    if (!amt || amt <= 0) return setError("회비 금액을 숫자로 입력해주세요.");

    const gAmt = parseInt(guestAmount.replace(/[^0-9]/g, ""), 10) || 0;
    if (guestOn && gAmt <= 0) return setError("비회원 참여비를 입력해주세요.");

    setBusy(true);
    // 새 회차가 곧 이번 회차가 되도록 기존 회차는 모두 내립니다.
    await supabase.from("dues_periods").update({ is_current: false }).eq("is_current", true);
    const { error: e2 } = await supabase.from("dues_periods").insert({
      label: label.trim(),
      amount: amt,
      due_date: dueDate || null,
      is_current: true,
      guest_dues_enabled: guestOn,
      guest_amount: gAmt,
    });
    setBusy(false);
    if (e2) return setError("만들지 못했어요.");
    setError("");
    setDueDate("");
    load();
  }

  async function setGuest(p: Period, on: boolean) {
    await supabase.from("dues_periods").update({ guest_dues_enabled: on }).eq("id", p.id);
    load();
  }

  async function updateGuestAmount(p: Period, value: string) {
    const amt = parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
    await supabase.from("dues_periods").update({ guest_amount: amt }).eq("id", p.id);
    load();
  }

  async function makeCurrent(id: string) {
    await supabase.from("dues_periods").update({ is_current: false }).eq("is_current", true);
    await supabase.from("dues_periods").update({ is_current: true }).eq("id", id);
    load();
  }

  return (
    <section>
      <form onSubmit={create} className="nr-card flex flex-col gap-2 p-3.5">
        <p className="nr-h2">새 회차 만들기</p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="회차 이름 (예: 2026년 8월 회비)"
          className="nr-input"
        />
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            placeholder="회원 1인당 금액"
            className="nr-input flex-1"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="nr-input flex-1"
          />
        </div>

        <div className="rounded-xl p-3" style={{ background: "var(--red-wash)", border: "1px solid var(--red-tint)" }}>
          <label className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--ink)" }}>
            <input type="checkbox" checked={guestOn} onChange={(e) => setGuestOn(e.target.checked)} />
            비회원에게도 참여비를 받기
          </label>

          {guestOn ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={guestAmount}
                  onChange={(e) => setGuestAmount(e.target.value)}
                  inputMode="numeric"
                  placeholder="1회 참여비"
                  className="nr-input flex-1"
                  style={{ padding: "8px 12px", fontSize: 14 }}
                />
                <span className="text-[12px]" style={{ color: "var(--muted)" }}>× 참여 횟수</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
                비회원은 참여한 횟수만큼만 냅니다. 횟수는 회비 화면에서 세어주세요.
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
              지금은 비회원에게 회비를 받지 않아요. 회비 화면에도 나오지 않습니다. 나중에 마음이 바뀌면 아래
              목록에서 켤 수 있어요.
            </p>
          )}
        </div>

        {error && <p className="text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}
        <button type="submit" disabled={busy} className="nr-btn nr-btn-primary py-3">
          이번 회차로 등록
        </button>
      </form>

      <div className="mt-3 flex flex-col gap-1.5">
        {periods.map((p) => (
          <div key={p.id} className={"nr-card p-3 " + (p.is_current ? "nr-card-tint" : "")}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>{p.label}</p>
                <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                  회원 {won(p.amount)}
                  {p.guest_dues_enabled ? ` · 비회원 ${won(p.guest_amount)}/회` : " · 비회원 안 받음"}
                  {p.due_date ? ` · ${p.due_date} 까지` : ""}
                </p>
              </div>
              {p.is_current ? (
                <span className="text-[11px] font-bold" style={{ color: "var(--mint-text)" }}>이번 회차</span>
              ) : (
                <button onClick={() => makeCurrent(p.id)} className="nr-btn-sm">이걸로 바꾸기</button>
              )}
            </div>

            {p.is_current && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setGuest(p, !p.guest_dues_enabled)}
                  className={"nr-btn-sm " + (p.guest_dues_enabled ? "nr-btn-sm-solid" : "")}
                >
                  {p.guest_dues_enabled ? "비회원 참여비 받는 중" : "비회원 참여비 안 받음"}
                </button>
                {p.guest_dues_enabled && (
                  <input
                    defaultValue={String(p.guest_amount)}
                    onBlur={(e) => updateGuestAmount(p, e.target.value)}
                    inputMode="numeric"
                    className="nr-input"
                    style={{ padding: "5px 10px", fontSize: 12, width: 96 }}
                    aria-label="비회원 1회 참여비"
                  />
                )}
              </div>
            )}
          </div>
        ))}
        {periods.length === 0 && <p className="nr-empty">아직 등록된 회차가 없어요.</p>}
      </div>
    </section>
  );
}

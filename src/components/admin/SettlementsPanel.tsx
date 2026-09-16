"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import { splitEvenly, won, type Settlement, type SettlementItem } from "@/lib/settlement";

type Member = { id: string; name: string; role: string | null };

const ROLE_ORDER: Record<string, number> = { lead: 0, sub_lead: 1, supporter: 2 };
function byRoleThenName(a: Member, b: Member) {
  const ra = a.role ? ROLE_ORDER[a.role] ?? 3 : 3;
  const rb = b.role ? ROLE_ORDER[b.role] ?? 3 : 3;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name, "ko");
}

export default function SettlementsPanel() {
  const [list, setList] = useState<Settlement[]>([]);
  const [shares, setShares] = useState<SettlementItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // 만들기
  const [making, setMaking] = useState(false);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [total, setTotal] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ss }, { data: sh }, { data: ms }] = await Promise.all([
        supabase.from("settlements").select("*").order("created_at", { ascending: false }),
        supabase.from("settlement_items").select("*"),
        supabase.from("crew_members").select("id, name, role").eq("active", true),
      ]);
      setList((ss ?? []) as Settlement[]);
      setShares((sh ?? []) as SettlementItem[]);
      setMembers(((ms ?? []) as Member[]).sort(byRoleThenName));
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const amounts = splitEvenly(parseInt(total.replace(/[^0-9]/g, ""), 10) || 0, picked.length);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("정산 이름을 입력해주세요.");
    if (picked.length === 0) return setError("나눠 낼 사람을 골라주세요.");
    const amt = parseInt(total.replace(/[^0-9]/g, ""), 10) || 0;
    if (amt <= 0) return setError("총 금액을 입력해주세요.");

    setBusy(true);
    const { data, error: e2 } = await supabase
      .from("settlements")
      .insert({
        title: title.trim(),
        memo: memo.trim() || null,
        due_date: dueDate || null,
      })
      .select("id")
      .single();

    if (e2 || !data) {
      setBusy(false);
      return setError("만들지 못했어요.");
    }

    const rows = picked.map((id, i) => ({
      settlement_id: data.id,
      member_id: id,
      amount: amounts[i],
    }));
    const { error: e3 } = await supabase.from("settlement_items").insert(rows);
    setBusy(false);
    if (e3) return setError("금액을 나누지 못했어요.");

    // 대상자에게 알림을 보냅니다.
    try {
      const pin = localStorage.getItem("nround-admin-pin") ?? "";
      await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          title: `정산 요청 · ${title.trim()}`,
          body: `${won(Math.round(amt / picked.length))} 내외 · 마이에서 확인해주세요`,
          url: "/me",
        }),
      });
    } catch {
      /* 알림은 실패해도 정산은 만들어졌습니다 */
    }

    setMaking(false);
    setTitle("");
    setMemo("");
    setDueDate("");
    setTotal("");
    setPicked([]);
    setError("");
    load();
  }

  async function togglePaid(sh: SettlementItem) {
    const next = !sh.paid;
    setShares((cur) =>
      cur.map((x) =>
        x.id === sh.id
          ? { ...x, paid: next, paid_at: next ? new Date().toISOString() : null, claimed_at: null }
          : x
      )
    );
    await supabase
      .from("settlement_items")
      .update({ paid: next, paid_at: next ? new Date().toISOString() : null, claimed_at: null })
      .eq("id", sh.id);
  }

  async function remove(s: Settlement) {
    const mine = shares.filter((x) => x.settlement_id === s.id);
    const unpaid = mine.filter((x) => !x.paid).length;
    const msg =
      unpaid > 0
        ? `아직 ${unpaid}명이 내지 않았어요.\n그래도 "${s.title}" 정산을 삭제할까요?`
        : `"${s.title}" 정산을 삭제할까요?`;
    if (!confirm(msg)) return;
    await supabase.from("settlements").delete().eq("id", s.id);
    load();
  }

  async function setOpen(s: Settlement, open: boolean) {
    await supabase.from("settlements").update({ is_open: open }).eq("id", s.id);
    load();
  }

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  if (loading) return <p className="nr-more">불러오는 중...</p>;

  return (
    <section>
      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {!making && (
        <button onClick={() => setMaking(true)} className="nr-btn nr-btn-primary mb-3">
          <Icon name="plus" size={17} /> 새 정산 만들기
        </button>
      )}

      {making && (
        <form onSubmit={create} className="nr-card mb-3 flex flex-col gap-2 p-3.5">
          <p className="nr-h2">새 정산</p>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="정산 이름 (예: 10월 버스킹 뒤풀이)"
            className="nr-input"
          />
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="무엇에 쓴 돈인지 (선택)"
            className="nr-input"
            style={{ fontSize: 14 }}
          />
          <div className="flex gap-2">
            <input
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              inputMode="numeric"
              placeholder="총 금액"
              className="nr-input flex-1"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="nr-input flex-1"
            />
          </div>

          <p className="nr-h2 mt-1">나눠 낼 사람</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPicked(picked.length === members.length ? [] : members.map((m) => m.id))}
              className="nr-btn-sm"
            >
              {picked.length === members.length ? "전체 해제" : "전체 선택"}
            </button>
            {members.map((m) => {
              const on = picked.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setPicked(on ? picked.filter((id) => id !== m.id) : [...picked, m.id])
                  }
                  className={"nr-btn-sm " + (on ? "nr-btn-sm-solid" : "")}
                >
                  {m.name}
                </button>
              );
            })}
          </div>

          {picked.length > 0 && amounts[0] > 0 && (
            <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              {picked.length}명이 나눠서 1인 {won(amounts[0])}
              {amounts[0] !== amounts[amounts.length - 1] && ` (일부 ${won(amounts[amounts.length - 1])})`}
            </p>
          )}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMaking(false);
                setError("");
              }}
              className="nr-btn nr-btn-ghost flex-1 py-2.5"
            >
              취소
            </button>
            <button type="submit" disabled={busy} className="nr-btn nr-btn-primary flex-1 py-2.5">
              {busy ? "보내는 중..." : "만들고 알리기"}
            </button>
          </div>
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            만들면 대상자에게 알림이 가고, 마이 화면에 표시돼요.
          </p>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {list.length === 0 && <p className="nr-empty">아직 만든 정산이 없어요.</p>}

        {list.map((s) => {
          const mine = shares.filter((x) => x.settlement_id === s.id);
          const paid = mine.filter((x) => x.paid).length;
          const sum = mine.reduce((n, x) => n + x.amount, 0);
          const got = mine.filter((x) => x.paid).reduce((n, x) => n + x.amount, 0);
          const waiting = mine.filter((x) => !x.paid && x.claimed_at);
          const showing = openId === s.id;

          return (
            <div key={s.id} className="nr-card p-3.5">
              <div className="flex items-center gap-2">
                <span className={"nr-badge " + (s.is_open ? "nr-badge-live" : "nr-badge-tint")}>
                  {s.is_open ? "진행중" : "마감"}
                </span>
                <span className="text-[14.5px] font-extrabold" style={{ color: "var(--ink)" }}>
                  {s.title}
                </span>
              </div>

              <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
                {paid}/{mine.length}명 · {won(got)} / {won(sum)}
                {s.due_date ? ` · ${s.due_date} 까지` : ""}
              </p>
              {s.memo && (
                <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
                  {s.memo}
                </p>
              )}

              {waiting.length > 0 && (
                <p className="mt-1.5 text-[11.5px]" style={{ color: "#9A5B2E" }}>
                  확인 대기 {waiting.length}건 — {waiting.map((x) => nameOf(x.member_id)).join(", ")}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => setOpenId(showing ? null : s.id)} className="nr-btn-sm">
                  {showing ? "접기" : "명단 보기"}
                </button>
                <button onClick={() => setOpen(s, !s.is_open)} className="nr-btn-sm">
                  {s.is_open ? "마감하기" : "다시 열기"}
                </button>
                <button
                  onClick={() => remove(s)}
                  className="nr-btn-sm"
                  style={{ borderColor: "transparent", background: "transparent" }}
                >
                  삭제
                </button>
              </div>

              {showing && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {mine.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => togglePaid(x)}
                      className="flex items-center gap-3 rounded-xl p-3 text-left"
                      style={
                        x.paid
                          ? { background: "var(--mint-bg)", border: "1px solid var(--mint)" }
                          : x.claimed_at
                          ? { background: "#FFF6E8", border: "1px solid #F6DCBE" }
                          : { border: "1px solid var(--border)" }
                      }
                    >
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                        style={{
                          background: x.paid ? "var(--mint)" : "#F4EAE6",
                          color: x.paid ? "#1F6B73" : "transparent",
                        }}
                      >
                        <Icon name="check" size={13} />
                      </span>
                      <span className="flex-1 text-[14px] font-bold" style={{ color: "var(--ink)" }}>
                        {nameOf(x.member_id)}
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                        {x.paid ? "완료" : x.claimed_at ? "보냈다고 함" : won(x.amount)}
                      </span>
                    </button>
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

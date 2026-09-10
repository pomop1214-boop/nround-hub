"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Member = { id: string; name: string; active: boolean; member_type: string };
type CredRow = { member_id: string; updated_at: string };

function randomPassword() {
  // 헷갈리는 글자(0/O, 1/l)는 뺐어요.
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function MembersPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [newType, setNewType] = useState<"member" | "guest">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [creds, setCreds] = useState<CredRow[]>([]);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwSaved, setPwSaved] = useState<{ name: string; pw: string } | null>(null);

  const pin = typeof window !== "undefined" ? localStorage.getItem("nround-admin-pin") ?? "" : "";

  const load = useCallback(async () => {
    const { data } = await supabase.from("crew_members").select("*").order("name");
    setMembers((data ?? []) as Member[]);

    // 비밀번호가 설정된 사람 목록만 받아옵니다(비밀번호 자체는 서버 밖으로 나오지 않아요).
    try {
      const res = await fetch(
        `/api/set-password?pin=${encodeURIComponent(localStorage.getItem("nround-admin-pin") ?? "")}`
      );
      if (res.ok) {
        const json = await res.json();
        setCreds(json.set ?? []);
      }
    } catch {
      /* 비밀번호 현황은 못 불러와도 명단은 보이게 둡니다 */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("이름을 입력해주세요.");
    setBusy(true);
    const { error: e2 } = await supabase.from("crew_members").insert({ name: n, member_type: newType });
    setBusy(false);
    if (e2) return setError(e2.code === "23505" ? "이미 있는 이름이에요." : "추가하지 못했어요.");
    setName("");
    setError("");
    load();
  }

  async function toggleType(m: Member) {
    const next = m.member_type === "guest" ? "member" : "guest";
    await supabase.from("crew_members").update({ member_type: next }).eq("id", m.id);
    load();
  }

  async function toggleActive(m: Member) {
    await supabase.from("crew_members").update({ active: !m.active }).eq("id", m.id);
    load();
  }

  async function remove(m: Member) {
    if (!confirm(`${m.name} 님을 명단에서 완전히 지울까요?\n투표·회비 기록도 함께 지워져요.`)) return;
    await supabase.from("crew_members").delete().eq("id", m.id);
    load();
  }

  async function savePassword(m: Member) {
    const pw = pwValue.trim();
    if (pw.length < 4) return setError("비밀번호는 4자 이상으로 정해주세요.");
    setBusy(true);
    const res = await fetch("/api/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, memberId: m.id, password: pw }),
    });
    setBusy(false);
    if (!res.ok) return setError("비밀번호를 저장하지 못했어요.");
    setError("");
    setPwSaved({ name: m.name, pw });
    setPwFor(null);
    setPwValue("");
    load();
  }

  const hasPassword = (id: string) => creds.some((c) => c.member_id === id);
  const activeCount = members.filter((m) => m.active).length;
  const guestCount = members.filter((m) => m.active && m.member_type === "guest").length;

  return (
    <section>
      <p className="nr-more">
        활동중 {activeCount}명 (비회원 {guestCount}명) · 전체 {members.length}명
      </p>

      <form onSubmit={add} className="mt-2 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="nr-input flex-1"
          />
          <button type="submit" disabled={busy} className="nr-btn-sm nr-btn-sm-solid px-4">추가</button>
        </div>
        <div className="flex gap-1.5">
          {(["member", "guest"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setNewType(t)}
              className={"nr-btn-sm flex-1 " + (newType === t ? "nr-btn-sm-solid" : "")}
            >
              {t === "member" ? "회원" : "비회원"}
            </button>
          ))}
        </div>
      </form>
      {error && <p className="mt-1.5 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      <div className="mt-3 flex flex-col gap-1.5">
        {members.map((m) => {
          const editing = pwFor === m.id;
          const has = hasPassword(m.id);
          return (
            <div key={m.id} className="nr-card p-3">
              <div className="flex items-center gap-2">
                <span
                  className="flex-1 text-[14.5px] font-bold"
                  style={
                    m.active
                      ? { color: "var(--ink)" }
                      : { color: "var(--muted)", textDecoration: "line-through" }
                  }
                >
                  {m.name}
                </span>
                {m.member_type === "guest" && <span className="nr-badge nr-badge-tint">비회원</span>}
                <span
                  className="text-[10.5px] font-bold"
                  style={{ color: has ? "var(--mint-text)" : "var(--red-deep)" }}
                >
                  {has ? "비번 있음" : "비번 없음"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    setPwFor(editing ? null : m.id);
                    setPwValue(editing ? "" : randomPassword());
                    setPwSaved(null);
                  }}
                  className="nr-btn-sm"
                >
                  {has ? "비밀번호 변경" : "비밀번호 정하기"}
                </button>
                <button onClick={() => toggleType(m)} className="nr-btn-sm">
                  {m.member_type === "guest" ? "회원으로" : "비회원으로"}
                </button>
                <button onClick={() => toggleActive(m)} className="nr-btn-sm">
                  {m.active ? "쉬는중으로" : "활동중으로"}
                </button>
                <button
                  onClick={() => remove(m)}
                  className="nr-btn-sm"
                  style={{ borderColor: "transparent", background: "transparent" }}
                >
                  삭제
                </button>
              </div>

              {editing && (
                <div className="mt-2 flex gap-1.5">
                  <input
                    autoFocus
                    value={pwValue}
                    onChange={(e) => setPwValue(e.target.value)}
                    placeholder="새 비밀번호"
                    className="nr-input flex-1"
                    style={{ padding: "8px 12px", fontSize: 14 }}
                  />
                  <button onClick={() => setPwValue(randomPassword())} className="nr-btn-sm" type="button">
                    새로 뽑기
                  </button>
                  <button onClick={() => savePassword(m)} disabled={busy} className="nr-btn-sm nr-btn-sm-solid">
                    저장
                  </button>
                </div>
              )}

              {pwSaved?.name === m.name && (
                <div
                  className="mt-2 rounded-xl p-2.5"
                  style={{ background: "var(--mint-bg)", border: "1px solid var(--mint)" }}
                >
                  <p className="text-[11.5px]" style={{ color: "var(--mint-text)" }}>
                    {pwSaved.name} 님 비밀번호를 <b>{pwSaved.pw}</b> 로 정했어요. 지금 전달해주세요.
                  </p>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `N.ROUND 허브 로그인\n이름: ${pwSaved.name}\n비밀번호: ${pwSaved.pw}`
                      )
                    }
                    className="nr-btn-sm mt-1.5"
                  >
                    전달용 문구 복사
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {members.length === 0 && <p className="nr-empty">아직 등록된 크루원이 없어요.</p>}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
        비밀번호는 저장하는 순간 암호화돼서, 나중에 다시 열어볼 수 없어요. 잊어버리면 새로 정해주면 됩니다.
        <br />
        잠시 쉬는 크루원은 삭제 대신 &apos;쉬는중&apos;으로 바꿔주세요. 명단에서만 빠지고 기록은 남아요.
      </p>
    </section>
  );
}

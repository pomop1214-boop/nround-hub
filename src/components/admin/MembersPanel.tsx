"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

type Member = {
  id: string;
  name: string;
  active: boolean;
  member_type: string;
  role: string | null;
  birth_date: string | null;
};

/** 화면에는 월·일만 보여줍니다. */
function mmdd(d: string | null) {
  return d ? `${d.slice(5, 7)}.${d.slice(8, 10)}` : null;
}

const ROLES: { key: string; label: string }[] = [
  { key: "lead", label: "운영장" },
  { key: "sub_lead", label: "부운영장" },
  { key: "supporter", label: "서포터즈" },
];

function roleLabel(role: string | null) {
  return ROLES.find((r) => r.key === role)?.label ?? null;
}

/** 운영장 → 부운영장 → 서포터즈 → 일반 순으로, 같은 직책끼리는 이름순 */
const ROLE_ORDER: Record<string, number> = { lead: 0, sub_lead: 1, supporter: 2 };

export function byRoleThenName<T extends { role: string | null; name: string }>(a: T, b: T) {
  const ra = a.role ? ROLE_ORDER[a.role] ?? 3 : 3;
  const rb = b.role ? ROLE_ORDER[b.role] ?? 3 : 3;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name, "ko");
}
type CredRow = { member_id: string; updated_at: string };

function randomPassword() {
  // 헷갈리는 글자(0/O, 1/l)는 뺐어요.
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function MembersPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  // 회원/비회원 선택은 "추가할 대상"이자 "목록 필터"로 함께 쓰입니다.
  const [newType, setNewType] = useState<"member" | "guest">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [creds, setCreds] = useState<CredRow[]>([]);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwSaved, setPwSaved] = useState<{ name: string; pw: string } | null>(null);
  const [roleFor, setRoleFor] = useState<string | null>(null);
  const [birthFor, setBirthFor] = useState<string | null>(null);
  const [birthValue, setBirthValue] = useState("");

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

  async function remove(m: Member) {
    if (!confirm(`${m.name} 님을 탈퇴 처리할까요?\n투표·회비·규정 동의 기록도 함께 지워지고 되돌릴 수 없어요.`))
      return;
    await supabase.from("crew_members").delete().eq("id", m.id);
    load();
  }

  async function saveBirth(m: Member) {
    const v = birthValue.trim();
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return setError("생년월일은 1999-09-17 형식으로 적어주세요.");
    }
    const { error: e } = await supabase
      .from("crew_members")
      .update({ birth_date: v || null })
      .eq("id", m.id);
    if (e) return setError("저장하지 못했어요.");
    setError("");
    setBirthFor(null);
    setBirthValue("");
    load();
  }

  async function setRole(m: Member, role: string | null) {
    await supabase.from("crew_members").update({ role }).eq("id", m.id);
    setRoleFor(null);
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
  const shown = members.filter((m) => m.member_type === newType).sort(byRoleThenName);
  const memberCount = members.filter((m) => m.member_type === "member").length;
  const guestCount = members.filter((m) => m.member_type === "guest").length;

  return (
    <section>
      <p className="nr-more">
        회원 {memberCount}명 · 비회원 {guestCount}명
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
        {shown.map((m) => {
          const editing = pwFor === m.id;
          const has = hasPassword(m.id);
          return (
            <div key={m.id} className="nr-card p-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[14.5px] font-bold" style={{ color: "var(--ink)" }}>
                  {m.name}
                </span>
                {roleLabel(m.role) && (
                  <span className="nr-badge nr-badge-red flex items-center gap-1">
                    <Icon name="crown" size={11} />
                    {roleLabel(m.role)}
                  </span>
                )}
                {mmdd(m.birth_date) && (
                  <span className="nr-badge nr-badge-tint">🎂 {mmdd(m.birth_date)}</span>
                )}
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
                    setRoleFor(null);
                  }}
                  className="nr-btn-sm"
                >
                  비밀번호 변경
                </button>
                <button
                  onClick={() => {
                    setRoleFor(roleFor === m.id ? null : m.id);
                    setPwFor(null);
                  }}
                  className={"nr-btn-sm flex items-center gap-1 " + (m.role ? "nr-btn-sm-solid" : "")}
                >
                  <Icon name="crown" size={12} />
                  운영진 임명
                </button>
                <button
                  onClick={() => {
                    setBirthFor(birthFor === m.id ? null : m.id);
                    setBirthValue(m.birth_date ?? "");
                    setRoleFor(null);
                    setPwFor(null);
                  }}
                  className="nr-btn-sm"
                >
                  {m.birth_date ? "생일 수정" : "생일 입력"}
                </button>
                <button onClick={() => toggleType(m)} className="nr-btn-sm">
                  {m.member_type === "guest" ? "회원으로 전환" : "비회원으로 전환"}
                </button>
                <button
                  onClick={() => remove(m)}
                  className="nr-btn-sm"
                  style={{ borderColor: "transparent", background: "transparent" }}
                >
                  탈퇴
                </button>
              </div>

              {birthFor === m.id && (
                <div className="mt-2 flex gap-1.5">
                  <input
                    autoFocus
                    type="date"
                    value={birthValue}
                    onChange={(e) => setBirthValue(e.target.value)}
                    className="nr-input flex-1"
                    style={{ padding: "8px 12px", fontSize: 14 }}
                  />
                  <button onClick={() => saveBirth(m)} className="nr-btn-sm nr-btn-sm-solid">
                    저장
                  </button>
                </div>
              )}

              {roleFor === m.id && (
                <div
                  className="mt-2 rounded-xl p-2.5"
                  style={{ background: "var(--red-wash)", border: "1px solid var(--red-tint)" }}
                >
                  <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                    {m.name} 님의 직책을 정해주세요
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ROLES.map((r) => (
                      <button
                        key={r.key}
                        onClick={() => setRole(m, r.key)}
                        className={
                          "nr-btn-sm flex items-center gap-1 " + (m.role === r.key ? "nr-btn-sm-solid" : "")
                        }
                      >
                        <Icon name="crown" size={12} />
                        {r.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setRole(m, null)}
                      className={"nr-btn-sm " + (!m.role ? "nr-btn-sm-solid" : "")}
                    >
                      직책 없음
                    </button>
                  </div>
                </div>
              )}

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
        {shown.length === 0 && (
          <p className="nr-empty">
            {newType === "member" ? "등록된 회원이 없어요." : "등록된 비회원이 없어요."}
          </p>
        )}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
        비밀번호는 저장하는 순간 암호화돼서, 나중에 다시 열어볼 수 없어요. 잊어버리면 새로 정해주면 됩니다.
        <br />
        위의 회원 / 비회원 버튼으로 목록을 바꿔볼 수 있어요. 새로 추가할 때도 선택한 쪽으로 들어가요.
        <br />
        생일은 가입 요청을 승인할 때 자동으로 들어와요. 비어 있으면 여기서 직접 넣어주세요.
        생일은 본인과 운영장만 볼 수 있어요.
        <br />
        탈퇴는 투표·회비·규정 기록까지 함께 지워지고 되돌릴 수 없어요.
      </p>
    </section>
  );
}

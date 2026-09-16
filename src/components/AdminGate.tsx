"use client";

import { useEffect, useState, type ReactNode } from "react";

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "1214";
const UNLOCK_KEY = "nround-admin-unlocked";
const ROLE_KEY = "nround-admin-role";

/** 이 화면에서 쓰는 권한 등급 */
export type AdminRole = "lead" | "sub_lead" | "supporter";

export default function AdminGate({
  children,
}: {
  children: (role: AdminRole) => ReactNode;
}) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [role, setRole] = useState<AdminRole>("lead");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/my-role")
      .then((r) => r.json())
      .then((d) => {
        const r = d.role as string | null;
        if (r === "lead" || r === "sub_lead" || r === "supporter") {
          // 운영진은 PIN 없이 자기 권한만큼 들어갑니다.
          setRole(r);
          localStorage.setItem(ROLE_KEY, r);
          if (r === "lead") localStorage.setItem("nround-admin-pin", ADMIN_PIN);
          localStorage.setItem(UNLOCK_KEY, "1");
          setState("open");
          return;
        }
        // 직책이 없으면 PIN 으로만 들어옵니다(운영장 권한).
        if (localStorage.getItem(UNLOCK_KEY) === "1" && localStorage.getItem(ROLE_KEY) === "lead") {
          setRole("lead");
          setState("open");
        } else {
          setState("locked");
        }
      })
      .catch(() => setState("locked"));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      localStorage.setItem("nround-admin-pin", pin);
      localStorage.setItem(UNLOCK_KEY, "1");
      localStorage.setItem(ROLE_KEY, "lead");
      setRole("lead");
      setState("open");
      setError("");
    } else {
      setError("PIN이 올바르지 않아요.");
    }
  }

  if (state === "checking") {
    return <div className="nr-card mx-auto mt-6 max-w-xs" style={{ height: 120, opacity: 0.5 }} />;
  }

  if (state === "open") return <>{children(role)}</>;

  return (
    <form onSubmit={handleSubmit} className="nr-card mx-auto mt-6 flex max-w-xs flex-col gap-2.5 p-5">
      <p className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>
        관리자 PIN
      </p>
      <input
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="nr-input"
        placeholder="PIN 숫자"
      />
      {error && <p className="text-[12px]" style={{ color: "var(--red)" }}>{error}</p>}
      <button type="submit" className="nr-btn nr-btn-primary py-3">확인</button>
      <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
        운영진으로 지정된 분은 PIN 없이 바로 들어와요.
      </p>
    </form>
  );
}

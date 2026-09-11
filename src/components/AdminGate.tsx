"use client";

import { useEffect, useState, type ReactNode } from "react";

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "1214";
const UNLOCK_KEY = "nround-admin-unlocked";

export default function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // 이 기기에서 한 번 확인했으면 다시 묻지 않습니다.
    if (localStorage.getItem(UNLOCK_KEY) === "1") {
      setState("open");
      return;
    }
    // 운영장은 PIN 없이 바로 들어갑니다.
    fetch("/api/my-role")
      .then((r) => r.json())
      .then((d) => {
        if (d.role === "lead") {
          localStorage.setItem(UNLOCK_KEY, "1");
          localStorage.setItem("nround-admin-pin", ADMIN_PIN);
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
      setState("open");
      setError("");
    } else {
      setError("PIN이 올바르지 않아요.");
    }
  }

  if (state === "checking") {
    return <div className="nr-card mx-auto mt-6 max-w-xs" style={{ height: 120, opacity: 0.5 }} />;
  }

  if (state === "open") return <>{children}</>;

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
        한 번 확인하면 이 기기에서는 다시 묻지 않아요.
      </p>
    </form>
  );
}

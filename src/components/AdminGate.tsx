"use client";

import { useState, type ReactNode } from "react";

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "1214";

export default function AdminGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setUnlocked(true);
      setError("");
      window.localStorage.setItem("nround-admin-pin", pin);
    } else {
      setError("PIN이 올바르지 않아요.");
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <form onSubmit={handleSubmit} className="nr-card mx-auto mt-6 flex max-w-xs flex-col gap-2.5 p-5">
      <p className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>관리자 PIN</p>
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
    </form>
  );
}

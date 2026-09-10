"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SubHeader } from "@/components/AppHeader";

export default function PasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/change-password")
      .then((r) => r.json())
      .then((d) => setMustChange(!!d.mustChange))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("새 비밀번호가 서로 달라요.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "바꾸지 못했어요.");
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/"), 1200);
  }

  return (
    <main className="nr-page">
      <SubHeader title="비밀번호 변경" />

      {mustChange && !done && (
        <div className="nr-card nr-card-tint p-4">
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--ink)" }}>
            운영자가 정해준 임시 비밀번호를 쓰고 있어요.
            <br />
            나만 아는 비밀번호로 바꿔주세요.
          </p>
        </div>
      )}

      {done ? (
        <div
          className="mt-4 rounded-2xl px-4 py-6 text-center"
          style={{ background: "var(--mint-bg)", border: "1px solid var(--mint)" }}
        >
          <p className="text-[15px] font-bold" style={{ color: "var(--mint-text)" }}>바꿨어요</p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--mint-text)" }}>
            다음부터는 새 비밀번호로 로그인하세요.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2.5">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="지금 쓰는 비밀번호"
            autoComplete="current-password"
            className="nr-input"
          />
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="새 비밀번호 (4자 이상)"
            autoComplete="new-password"
            className="nr-input"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="새 비밀번호 다시 입력"
            autoComplete="new-password"
            className="nr-input"
          />
          {error && (
            <p className="px-1 text-[12.5px]" style={{ color: "var(--red-deep)" }}>{error}</p>
          )}
          <button type="submit" disabled={busy} className="nr-btn nr-btn-primary mt-1">
            {busy ? "바꾸는 중" : "비밀번호 바꾸기"}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
        바꾼 비밀번호는 운영자도 볼 수 없어요.
        <br />
        잊어버리면 운영자에게 새로 받아야 해요.
      </p>
    </main>
  );
}

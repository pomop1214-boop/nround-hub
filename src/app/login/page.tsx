"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

const ME_KEY = "nround_me_v1";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [firstTime, setFirstTime] = useState(false);

  const [mode, setMode] = useState<null | "join" | "reset">(null);
  const [reqName, setReqName] = useState("");
  const [birth, setBirth] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqError, setReqError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch("/api/setup-status")
      .then((r) => r.json())
      .then((d) => setFirstTime(!!d.empty))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인하지 못했어요.");
        setBusy(false);
        return;
      }
      // 각 화면이 "내가 누구인지" 알 수 있게 기기에도 남겨둡니다.
      localStorage.setItem(ME_KEY, data.id);
      localStorage.setItem("nround_me_name", data.name);
      router.replace("/");
      router.refresh();
    } catch {
      setError("연결에 실패했어요. 잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  }

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    setReqBusy(true);
    setReqError("");
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: mode, name: reqName, birthDate: birth }),
      });
      const data = await res.json();
      setReqBusy(false);
      if (!res.ok) {
        setReqError(data.error ?? "보내지 못했어요.");
        return;
      }
      setSent(true);
    } catch {
      setReqBusy(false);
      setReqError("연결에 실패했어요.");
    }
  }

  return (
    <main className="nr-page flex min-h-screen flex-col justify-center" style={{ paddingBottom: 40 }}>
      <div
        className="relative overflow-hidden rounded-2xl px-5 py-8 text-center"
        style={{ background: "linear-gradient(135deg, #EE5340 0%, #DB3E2C 100%)" }}
      >
        <svg
          viewBox="0 0 400 220"
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <g className="nr-disc-spin">
            {[50, 76, 102, 128, 154, 180, 206].map((r) => (
              <circle key={r} cx="358" cy="14" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.2" />
            ))}
            <circle cx="358" cy="14" r="38" fill="#A9DCE0" opacity="0.92" />
            <circle cx="358" cy="14" r="9" fill="#FFF6F4" />
          </g>
        </svg>
        <div className="relative">
          <p className="text-[10px] font-bold tracking-[0.35em]" style={{ color: "rgba(255,255,255,.8)" }}>
            VOCAL CREW
          </p>
          <h1 className="nr-wordmark mt-2" style={{ fontSize: 34, color: "#fff" }}>N.ROUND</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          autoComplete="username"
          className="nr-input"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoComplete="current-password"
          className="nr-input"
        />
        {error && (
          <p className="px-1 text-[12.5px] leading-relaxed" style={{ color: "var(--red-deep)" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="nr-btn nr-btn-primary mt-1">
          {busy ? "확인하는 중" : "들어가기"}
        </button>
      </form>

      {firstTime ? (
        <div className="nr-card nr-card-tint mt-5 p-4">
          <p className="text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
            아직 등록된 크루원이 없어요
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
            관리자 화면에서 크루원을 등록하고 비밀번호를 정해주세요. 한 명이라도 등록되면 이 버튼은
            사라져요.
          </p>
          <Link href="/admin" className="nr-btn nr-btn-primary mt-3 py-3">
            <Icon name="settings" size={16} />
            관리자 화면으로
          </Link>
        </div>
      ) : (
        <div className="mt-5">
          {sent ? (
            <div
              className="rounded-xl px-4 py-4 text-center"
              style={{ background: "var(--mint-bg)", border: "1px solid var(--mint)" }}
            >
              <p className="text-[13.5px] font-bold" style={{ color: "var(--mint-text)" }}>
                요청을 보냈어요
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--mint-text)" }}>
                운영장이 확인하면 연락드릴게요.
              </p>
            </div>
          ) : mode === null ? (
            <div className="flex gap-2">
              <button onClick={() => setMode("join")} className="nr-btn nr-btn-ghost flex-1 py-3">
                회원가입 요청
              </button>
              <button onClick={() => setMode("reset")} className="nr-btn nr-btn-ghost flex-1 py-3">
                비밀번호 재발급
              </button>
            </div>
          ) : (
            <form onSubmit={sendRequest} className="nr-card flex flex-col gap-2 p-4">
              <p className="text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
                {mode === "join" ? "회원가입 요청" : "비밀번호 재발급 요청"}
              </p>
              <input
                autoFocus
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
                placeholder="이름"
                className="nr-input"
              />
              {mode === "join" && (
                <input
                  value={birth}
                  onChange={(e) => setBirth(e.target.value)}
                  placeholder="생년월일 (예: 1999-12-14)"
                  inputMode="numeric"
                  className="nr-input"
                />
              )}
              {reqError && (
                <p className="text-[12px]" style={{ color: "var(--red-deep)" }}>{reqError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode(null);
                    setReqError("");
                  }}
                  className="nr-btn nr-btn-ghost flex-1 py-2.5"
                >
                  취소
                </button>
                <button type="submit" disabled={reqBusy} className="nr-btn nr-btn-primary flex-1 py-2.5">
                  {reqBusy ? "보내는 중" : "보내기"}
                </button>
              </div>
              <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
                운영장에게 알림이 가요.
              </p>
            </form>
          )}
        </div>
      )}
    </main>
  );
}

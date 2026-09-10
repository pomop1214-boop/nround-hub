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
          <p className="mt-2 text-[13px]" style={{ color: "rgba(255,255,255,.9)" }}>
            함께 부르는, 새로운 라운드.
          </p>
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
        <p className="mt-6 text-center text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
          비밀번호는 운영자가 정해서 알려줘요.
          <br />
          모르면 시안에게 물어보세요.
        </p>
      )}
    </main>
  );
}

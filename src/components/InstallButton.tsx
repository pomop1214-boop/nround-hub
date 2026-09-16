"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** 홈 화면에 추가 — 안드로이드·크롬은 버튼 한 번, 아이폰은 방법 안내 */
export default function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

    function onPrompt(e: Event) {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // 이미 앱으로 실행 중이면 버튼을 숨깁니다.
  if (installed) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPrompt(null);
      return;
    }
    setShowGuide((v) => !v);
  }

  return (
    <div>
      <button
        onClick={install}
        className="flex w-full items-center gap-2.5 rounded-xl px-4 py-3.5"
        style={{
          background: "var(--red-wash)",
          border: "1px solid var(--red-tint)",
          color: "var(--red-deep)",
        }}
      >
        <Icon name="plus" size={17} />
        <span className="flex-1 text-left text-[13px] font-bold">홈 화면에 앱으로 추가</span>
        <span className="text-[12px] font-semibold">추가</span>
      </button>

      {showGuide && (
        <div
          className="mt-2 rounded-xl p-3.5 text-[12px] leading-relaxed"
          style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--muted)" }}
        >
          {isIOS ? (
            <>
              사파리 아래쪽 <b style={{ color: "var(--ink)" }}>공유 버튼</b>(↑)을 누르고
              <br />
              <b style={{ color: "var(--ink)" }}>&lsquo;홈 화면에 추가&rsquo;</b>를 골라주세요.
            </>
          ) : (
            <>
              브라우저 메뉴(⋮)에서 <b style={{ color: "var(--ink)" }}>&lsquo;앱 설치&rsquo;</b> 또는{" "}
              <b style={{ color: "var(--ink)" }}>&lsquo;홈 화면에 추가&rsquo;</b>를 골라주세요.
              <br />
              카카오톡 브라우저에서는 안 되니 크롬이나 사파리로 열어주세요.
            </>
          )}
        </div>
      )}
    </div>
  );
}

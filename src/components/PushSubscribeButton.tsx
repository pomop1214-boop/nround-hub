"use client";

import { useEffect, useState } from "react";
import { subscribeToPush } from "@/lib/push";
import Icon from "./Icon";

type State = "checking" | "off" | "on" | "loading" | "error" | "blocked";

export default function PushSubscribeButton() {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState("");

  /** 이 기기에서 이미 켜져 있는지 확인합니다. */
  useEffect(() => {
    let alive = true;

    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (alive) setState("off");
        return;
      }

      // 권한을 거부해 둔 상태면 버튼을 눌러도 켤 수 없습니다.
      if (Notification.permission === "denied") {
        if (alive) setState("blocked");
        return;
      }
      if (Notification.permission !== "granted") {
        if (alive) setState("off");
        return;
      }

      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (alive) setState(sub ? "on" : "off");
      } catch {
        if (alive) setState("off");
      }
    }

    check();
    // 설정에서 권한을 바꾸고 돌아올 수 있으니 다시 확인합니다.
    function onVisible() {
      if (!document.hidden) check();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function turnOn() {
    setState("loading");
    try {
      await subscribeToPush();
      setState("on");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "알림을 켜지 못했어요.");
    }
  }

  // 확인 중에는 자리만 잡아둡니다(깜빡임 방지).
  if (state === "checking") {
    return <div className="rounded-xl" style={{ height: 46, background: "var(--bg-soft)" }} />;
  }

  if (state === "on") {
    return (
      <div
        className="flex items-center gap-2.5 rounded-xl px-4 py-3.5"
        style={{
          background: "var(--mint-bg)",
          border: "1px solid var(--mint)",
          color: "var(--mint-text)",
        }}
      >
        <Icon name="check" size={17} />
        <span className="text-[13px] font-bold">알림 켜짐 · 새 소식이 오면 알려드려요</span>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div
        className="rounded-xl px-4 py-3.5"
        style={{ background: "#FFF6E8", border: "1px solid #F6DCBE", color: "#9A5B2E" }}
      >
        <p className="text-[13px] font-bold">알림이 차단되어 있어요</p>
        <p className="mt-1 text-[11.5px] leading-relaxed">
          브라우저 주소창의 자물쇠(또는 설정 → 사이트 권한)에서 알림을 허용으로 바꿔주세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={turnOn}
        disabled={state === "loading"}
        className="flex w-full items-center gap-2.5 rounded-xl px-4 py-3.5"
        style={{
          background: "var(--mint-bg)",
          border: "1px solid var(--mint)",
          color: "var(--mint-text)",
          cursor: "pointer",
        }}
      >
        <Icon name="bell" size={17} />
        <span className="flex-1 text-left text-[13px] font-bold">공지 알림 켜기</span>
        <span className="text-[12px] font-semibold">{state === "loading" ? "여는 중" : "켜기"}</span>
      </button>

      {state === "error" && (
        <p className="mt-1.5 px-1 text-[12px] leading-relaxed" style={{ color: "var(--red-deep)" }}>
          {message}
        </p>
      )}
    </div>
  );
}

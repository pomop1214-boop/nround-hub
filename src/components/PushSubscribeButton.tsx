"use client";

import { useState } from "react";
import { subscribeToPush } from "@/lib/push";
import Icon from "./Icon";

export default function PushSubscribeButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleClick() {
    setStatus("loading");
    try {
      await subscribeToPush();
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "알림을 켜지 못했어요.");
    }
  }

  if (status === "done") {
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
        <span className="text-[13px] font-bold">알림 켜짐 · 새 공지가 오면 바로 알려드려요</span>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={status === "loading"}
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
        <span className="text-[12px] font-semibold">
          {status === "loading" ? "여는 중" : "켜기"}
        </span>
      </button>
      {status === "error" && (
        <p className="mt-1.5 px-1 text-[12px] leading-relaxed" style={{ color: "var(--red-deep)" }}>
          {message}
        </p>
      )}
    </div>
  );
}

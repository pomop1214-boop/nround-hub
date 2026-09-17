"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { loadAlerts } from "@/lib/alerts";

const ME_KEY = "nround_me_v1";

/** 홈 상단 종 — 확인하지 않은 것이 있으면 개수가 붙습니다. */
export default function BellButton() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const meId = localStorage.getItem(ME_KEY);
    if (!meId) return;
    const a = await loadAlerts(meId);
    setCount(a.total);
  }, []);

  useEffect(() => {
    refresh();

    // 알림을 확인하고 돌아오면 개수가 바로 줄도록 다시 셉니다.
    function onFocus() {
      refresh();
    }
    function onVisible() {
      if (!document.hidden) refresh();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    // 다른 사람이 새로 올린 것도 잡히도록 1분마다 확인합니다.
    const timer = setInterval(refresh, 60_000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [refresh]);

  return (
    <Link href="/alerts" className="relative" aria-label={count > 0 ? `알림 ${count}개` : "알림"}>
      <span style={{ color: "var(--body)" }}>
        <Icon name="bell" size={20} />
      </span>
      {count > 0 && (
        <span
          className="absolute grid place-items-center rounded-full text-[9px] font-bold"
          style={{
            top: -4,
            right: -5,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            background: "var(--red)",
            color: "#fff",
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

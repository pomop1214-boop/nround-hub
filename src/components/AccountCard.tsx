"use client";

import { useState } from "react";
import Icon from "./Icon";

/** 계좌번호를 보여주고 한 번에 복사할 수 있는 카드 */
export default function AccountCard({
  bank,
  number,
  holder,
  compact = false,
}: {
  bank?: string | null;
  number: string;
  holder?: string | null;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div
      className={compact ? "rounded-xl p-3" : "nr-card p-4"}
      style={
        compact
          ? { background: "var(--red-wash)", border: "1px solid var(--red-tint)" }
          : undefined
      }
    >
      <p className={compact ? "text-[11px]" : "nr-h2"} style={compact ? { color: "var(--muted)" } : undefined}>
        {compact ? [bank, holder].filter(Boolean).join(" · ") || "입금 계좌" : "입금 계좌"}
      </p>

      {!compact && (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--muted)" }}>
          {[bank, holder].filter(Boolean).join(" · ")}
        </p>
      )}

      <p
        className={compact ? "mt-0.5 text-[16px] font-bold" : "mt-0.5 text-[19px] font-bold"}
        style={{ color: "var(--ink)" }}
      >
        {number}
      </p>

      <button
        onClick={copy}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold"
        style={
          copied
            ? { background: "var(--mint-bg)", border: "1px solid var(--mint)", color: "var(--mint-text)" }
            : { background: "#fff", border: "1px solid var(--red-tint)", color: "var(--red-deep)" }
        }
      >
        <Icon name={copied ? "check" : "copy"} size={14} />
        {copied ? "복사했어요" : "계좌번호 복사"}
      </button>
    </div>
  );
}

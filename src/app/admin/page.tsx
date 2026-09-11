"use client";

import { useState } from "react";
import AdminGate from "@/components/AdminGate";
import Icon from "@/components/Icon";
import Link from "next/link";
import { SubHeader } from "@/components/AppHeader";
import MembersPanel from "@/components/admin/MembersPanel";
import DuesPeriodsPanel from "@/components/admin/DuesPeriodsPanel";
import StrikesPanel from "@/components/admin/StrikesPanel";
import RulesPanel from "@/components/admin/RulesPanel";
import EventsPanel from "@/components/admin/EventsPanel";
import RequestsPanel from "@/components/admin/RequestsPanel";

type Tab = "requests" | "notice" | "events" | "members" | "dues" | "strikes" | "rules";

const TABS: { key: Tab; label: string }[] = [
  { key: "requests", label: "요청" },
  { key: "notice", label: "공지 발송" },
  { key: "events", label: "일정" },
  { key: "members", label: "크루원" },
  { key: "dues", label: "회비 회차" },
  { key: "strikes", label: "미확인" },
  { key: "rules", label: "규정" },
];

function NoticeForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("공지 제목을 입력해주세요.");
    setError("");
    setStatus("sending");
    const pin = window.localStorage.getItem("nround-admin-pin") || "";
    const res = await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, title, body, url }),
    });
    setStatus(res.ok ? "done" : "error");
    if (res.ok) {
      setTitle("");
      setBody("");
      setUrl("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="공지 제목"
        className="nr-input"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="공지 내용 (선택)"
        rows={3}
        className="nr-input"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="연결할 링크 (선택)"
        className="nr-input"
      />
      {error && <p className="text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}
      <button type="submit" disabled={status === "sending"} className="nr-btn nr-btn-primary py-3">
        {status === "sending" ? "보내는 중" : "공지 보내기"}
      </button>
      {status === "done" && <p className="text-[12px]" style={{ color: "var(--mint-text)" }}>보냈어요.</p>}
      {status === "error" && (
        <p className="text-[12px]" style={{ color: "var(--red-deep)" }}>
          보내지 못했어요. 잠시 후 다시 시도해주세요.
        </p>
      )}
      <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
        알림을 구독한 크루원에게 푸시가 가고, 홈 화면 공지 목록에도 함께 올라가요.
      </p>
    </form>
  );
}

function AdminBody() {
  const [tab, setTab] = useState<Tab>("requests");

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={"nr-btn-sm flex-1 basis-[30%] py-2 " + (tab === t.key ? "nr-btn-sm-solid" : "")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "requests" && <RequestsPanel />}
        {tab === "notice" && <NoticeForm />}
        {tab === "events" && <EventsPanel />}
        {tab === "members" && <MembersPanel />}
        {tab === "dues" && (
          <>
            <Link href="/dues" className="nr-card mb-3 flex items-center gap-3 p-3.5">
              <span className="nr-iconbox">
                <Icon name="wallet" size={18} />
              </span>
              <span className="flex-1">
                <span className="block text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
                  이번 회차 납부 명단
                </span>
                <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--muted)" }}>
                  입금 확인하고 체크하기
                </span>
              </span>
              <span style={{ color: "var(--muted)" }}>
                <Icon name="chevron" size={16} />
              </span>
            </Link>
            <DuesPeriodsPanel />
          </>
        )}
        {tab === "strikes" && <StrikesPanel />}
        {tab === "rules" && <RulesPanel />}
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <main className="nr-page">
      <SubHeader title="관리자" />
      <AdminGate>
        <AdminBody />
      </AdminGate>
    </main>
  );
}

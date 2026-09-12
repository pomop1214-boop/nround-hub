"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";

type Req = {
  id: string;
  type: "join" | "reset";
  name: string;
  birth_date: string | null;
  created_at: string;
};

type Issued = { name: string; password: string; created: boolean };

export default function RequestsPanel() {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pin = localStorage.getItem("nround-admin-pin") ?? "";
      const res = await fetch(`/api/requests?pin=${encodeURIComponent(pin)}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRequests(json.requests ?? []);
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(r: Req, action: "approve" | "reject") {
    if (action === "reject" && !confirm(`${r.name} 님의 요청을 거절할까요?`)) return;

    setBusyId(r.id);
    setError("");
    const pin = localStorage.getItem("nround-admin-pin") ?? "";
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, id: r.id, action }),
    });
    const json = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setError(json.error ?? "처리하지 못했어요.");
      return;
    }

    if (action === "approve") {
      setIssued({ name: json.name, password: json.password, created: json.created });
      setCopied(false);
    }
    load();
  }

  function copyIssued() {
    if (!issued) return;
    navigator.clipboard
      .writeText(
        `N.ROUND 허브 로그인\n주소: ${window.location.origin}\n이름: ${issued.name}\n비밀번호: ${issued.password}`
      )
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  }

  if (loading) return <p className="nr-more">불러오는 중...</p>;

  return (
    <section>
      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {/* 승인 직후 발급된 비밀번호 */}
      {issued && (
        <div
          className="mb-3 rounded-2xl p-4"
          style={{ background: "var(--mint-bg)", border: "1px solid var(--mint)" }}
        >
          <p className="text-[13.5px] font-bold" style={{ color: "var(--mint-text)" }}>
            {issued.created ? "계정을 만들었어요" : "비밀번호를 새로 발급했어요"}
          </p>
          <p className="mt-2 text-[13px]" style={{ color: "var(--mint-text)" }}>
            {issued.name} · 비밀번호 <b style={{ fontSize: 15 }}>{issued.password}</b>
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--mint-text)" }}>
            지금 전달해주세요. 이 창을 닫으면 다시 볼 수 없어요.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button onClick={copyIssued} className="nr-btn-sm flex-1">
              {copied ? "복사했어요" : "전달용 문구 복사"}
            </button>
            <button onClick={() => setIssued(null)} className="nr-btn-sm nr-btn-sm-solid flex-1">
              확인
            </button>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <p className="nr-empty">새로 들어온 요청이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <div key={r.id} className="nr-card nr-card-tint p-3.5">
              <div className="flex items-center gap-2">
                <span className="nr-badge nr-badge-red">
                  {r.type === "join" ? "가입 요청" : "비밀번호 재발급"}
                </span>
                <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>
                  {r.created_at.slice(5, 10).replace("-", "/")}
                </span>
              </div>

              <p className="mt-2 text-[15px] font-extrabold" style={{ color: "var(--ink)" }}>
                {r.name}
              </p>
              {r.birth_date && (
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
                  생년월일 {r.birth_date}
                </p>
              )}

              <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
                {r.type === "join"
                  ? "승인하면 회원으로 등록되고 비밀번호가 바로 발급돼요."
                  : "승인하면 비밀번호가 새로 발급돼요. 명단에 있는 이름이어야 해요."}
              </p>

              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => act(r, "reject")}
                  disabled={busyId === r.id}
                  className="nr-btn-sm flex-1 py-2"
                >
                  거절
                </button>
                <button
                  onClick={() => act(r, "approve")}
                  disabled={busyId === r.id}
                  className="nr-btn-sm nr-btn-sm-solid flex-1 py-2"
                >
                  {busyId === r.id ? "처리 중" : "승인"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
        <Icon name="alert" size={13} />
        로그인 화면에서 크루원이 보낸 요청이 여기로 모여요. 운영장 기기로 알림도 갑니다.
      </p>
    </section>
  );
}

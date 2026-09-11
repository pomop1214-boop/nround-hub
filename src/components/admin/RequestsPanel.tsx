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

export default function RequestsPanel() {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  async function done(id: string) {
    const pin = localStorage.getItem("nround-admin-pin") ?? "";
    await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, id }),
    });
    load();
  }

  if (loading) return <p className="nr-more">불러오는 중...</p>;

  return (
    <section>
      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

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
                  ? "크루원 탭에서 이름을 추가하고 비밀번호를 정해 전달해주세요."
                  : "크루원 탭에서 비밀번호를 새로 정해 전달해주세요."}
              </p>
              <button onClick={() => done(r.id)} className="nr-btn-sm nr-btn-sm-solid mt-2.5">
                처리 완료
              </button>
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

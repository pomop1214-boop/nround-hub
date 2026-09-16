"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";

type Notice = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  created_at: string;
};

const ME_KEY = "nround_me_v1";

function fmt(iso: string) {
  const d = new Date(iso);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(
    2,
    "0"
  )} (${wd})`;
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (e) setError("불러오지 못했어요.");
    setNotices((data ?? []) as Notice[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("nround-admin-unlocked") === "1");
    load();
    // 공지함을 열었으니 읽음으로 처리합니다(기기가 바뀌어도 유지되게 서버에 기록).
    const meId = localStorage.getItem(ME_KEY);
    if (meId) {
      supabase
        .from("crew_members")
        .update({ notices_seen_at: new Date().toISOString() })
        .eq("id", meId)
        .then(() => {});
    }
  }, [load]);

  async function remove(n: Notice) {
    if (!confirm(`"${n.title}" 공지를 삭제할까요?\n되돌릴 수 없어요.`)) return;
    const pin = localStorage.getItem("nround-admin-pin") ?? "";
    const res = await fetch("/api/notice", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, id: n.id }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "삭제하지 못했어요.");
      return;
    }
    setError("");
    load();
  }

  if (loading) {
    return (
      <main className="nr-page">
        <SubHeader title="공지사항" />
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="nr-card" style={{ height: 64, opacity: 0.55 }} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="nr-page">
      <SubHeader title="공지사항" />

      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {notices.length === 0 ? (
        <p className="nr-empty">아직 올라온 공지가 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notices.map((n, i) => {
            const open = openId === n.id;
            return (
              <div key={n.id} className={"nr-card p-4 " + (i === 0 ? "nr-card-tint" : "")}>
                <button
                  onClick={() => setOpenId(open ? null : n.id)}
                  className="flex w-full items-start gap-2.5 text-left"
                >
                  <span
                    className="mt-1.5 h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{ background: "var(--red)" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-bold" style={{ color: "var(--ink)" }}>
                      {n.title}
                    </span>
                    <span className="mt-1 block text-[11.5px]" style={{ color: "var(--muted)" }}>
                      {fmt(n.created_at)}
                    </span>
                  </span>
                  {n.body && (
                    <span
                      style={{
                        color: "var(--muted)",
                        transform: open ? "rotate(90deg)" : undefined,
                        transition: "transform .2s",
                      }}
                    >
                      <Icon name="chevron" size={15} />
                    </span>
                  )}
                </button>

                {open && n.body && (
                  <p
                    className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed"
                    style={{ color: "#4a3f39" }}
                  >
                    {n.body}
                  </p>
                )}

                {open && n.url && (
                  <a
                    href={n.url}
                    className="mt-2 inline-block text-[12px] font-bold underline"
                    style={{ color: "var(--red-deep)" }}
                  >
                    바로가기
                  </a>
                )}

                {isAdmin && (
                  <button
                    onClick={() => remove(n)}
                    className="nr-btn-sm mt-2.5"
                    style={{ borderColor: "transparent", background: "transparent" }}
                  >
                    삭제
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && notices.length > 0 && (
        <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>
          삭제 버튼은 운영자에게만 보여요.
        </p>
      )}
    </main>
  );
}

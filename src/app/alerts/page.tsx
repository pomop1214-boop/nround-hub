"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";
import { emptyAlerts, loadAlerts, markNoticesSeen, type Alerts } from "@/lib/alerts";
import { fmtDeadline } from "@/lib/vote";

const ME_KEY = "nround_me_v1";

function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function Row({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: string;
  title: string;
  sub?: string;
}) {
  return (
    <Link href={href} className="nr-card nr-card-tint flex items-center gap-3 p-3.5">
      <span className="nr-iconbox" style={{ width: 36, height: 36 }}>
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
          {title}
        </span>
        {sub && (
          <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--muted)" }}>
            {sub}
          </span>
        )}
      </span>
      <span style={{ color: "var(--muted)" }}>
        <Icon name="chevron" size={15} />
      </span>
    </Link>
  );
}

export default function AlertsPage() {
  const [a, setA] = useState<Alerts>(emptyAlerts);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const meId = localStorage.getItem(ME_KEY);
    if (!meId) {
      setLoading(false);
      return;
    }
    const next = await loadAlerts(meId);
    setA(next);
    setLoading(false);

    // 이 화면을 열었으니 공지는 읽음으로 처리합니다.
    if (next.notices.length > 0) await markNoticesSeen(meId);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <main className="nr-page">
        <SubHeader title="알림" />
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="nr-card" style={{ height: 62, opacity: 0.55 }} />
          ))}
        </div>
      </main>
    );
  }

  if (a.total === 0) {
    return (
      <main className="nr-page">
        <SubHeader title="알림" />
        <div className="nr-empty">
          확인할 게 없어요.
          <br />
          새 투표·공지·정산이 오면 여기에 표시돼요.
        </div>
      </main>
    );
  }

  return (
    <main className="nr-page">
      <SubHeader title="알림" />

      {a.votes.length > 0 && (
        <section className="mb-5">
          <h2 className="nr-h2">응답하지 않은 투표</h2>
          <div className="mt-2 flex flex-col gap-2">
            {a.votes.map((v) => (
              <Row
                key={v.id}
                href="/vote"
                icon="chart"
                title={v.title}
                sub={v.deadline ? fmtDeadline(v.deadline) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {(a.dues || a.settles.length > 0) && (
        <section className="mb-5">
          <h2 className="nr-h2">미납</h2>
          <div className="mt-2 flex flex-col gap-2">
            {a.dues && (
              <Row
                href="/me"
                icon="wallet"
                title={a.dues.label}
                sub={`${won(a.dues.amount)}${a.dues.due_date ? ` · ${a.dues.due_date} 까지` : ""}`}
              />
            )}
            {a.settles.map((s) => (
              <Row
                key={s.id}
                href="/me"
                icon="wallet"
                title={s.title}
                sub={`${won(s.amount)}${s.due_date ? ` · ${s.due_date} 까지` : ""}`}
              />
            ))}
          </div>
        </section>
      )}

      {a.rules.length > 0 && (
        <section className="mb-5">
          <h2 className="nr-h2">확인하지 않은 규정</h2>
          <div className="mt-2 flex flex-col gap-2">
            {a.rules.map((r) => (
              <Row key={r.id} href="/rules" icon="doc" title={r.title} />
            ))}
          </div>
        </section>
      )}

      {a.notices.length > 0 && (
        <section className="mb-5">
          <h2 className="nr-h2">새 공지</h2>
          <div className="mt-2 flex flex-col gap-2">
            {a.notices.map((n) => (
              <Row
                key={n.id}
                href="/notices"
                icon="bell"
                title={n.title}
                sub={n.created_at.slice(5, 10).replace("-", "/")}
              />
            ))}
          </div>
          <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
            이 화면을 열었으니 공지는 읽음으로 처리했어요.
          </p>
        </section>
      )}
    </main>
  );
}

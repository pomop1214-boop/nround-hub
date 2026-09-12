"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  answersOf,
  pickedBy,
  questionsOf,
  type ResponseRow,
  type VoteRow,
} from "@/lib/vote";

type Member = { id: string; name: string; role: string | null };

const ROLE_ORDER: Record<string, number> = { lead: 0, sub_lead: 1, supporter: 2 };
function byRoleThenName(a: Member, b: Member) {
  const ra = a.role ? ROLE_ORDER[a.role] ?? 3 : 3;
  const rb = b.role ? ROLE_ORDER[b.role] ?? 3 : 3;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name, "ko");
}

function fmtFull(iso: string) {
  const d = new Date(iso);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} (${wd}) ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

export default function VoteReportPage({ params }: { params: { id: string } }) {
  const [vote, setVote] = useState<VoteRow | null>(null);
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const load = useCallback(async () => {
    const [{ data: v }, { data: rs }, { data: ms }] = await Promise.all([
      supabase.from("votes").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("vote_responses").select("vote_id, member_id, choice, answers").eq("vote_id", params.id),
      supabase.from("crew_members").select("id, name, role").eq("active", true),
    ]);
    setVote((v ?? null) as VoteRow | null);
    setRows((rs ?? []) as ResponseRow[]);
    setMembers(((ms ?? []) as Member[]).sort(byRoleThenName));
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    // 집계는 운영자만 볼 수 있게 합니다.
    setAllowed(localStorage.getItem("nround-admin-unlocked") === "1");
    load();
  }, [load]);

  if (loading) return <main className="rp"><p>불러오는 중...</p></main>;

  if (!allowed) {
    return (
      <main className="rp">
        <p style={{ fontSize: 14 }}>운영자만 볼 수 있어요. 관리자 화면에서 PIN을 먼저 입력해주세요.</p>
        <style jsx global>{`
          .rp { max-width: 720px; margin: 0 auto; padding: 40px 20px; font-family: "Pretendard", sans-serif; }
        `}</style>
      </main>
    );
  }

  if (!vote) return <main className="rp"><p>투표를 찾을 수 없어요.</p></main>;

  const qs = questionsOf(vote);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";
  const answered = rows.map((r) => r.member_id);
  const missing = members.filter((m) => !answered.includes(m.id));

  return (
    <main className="rp">
      <div className="rp-actions">
        <button onClick={() => window.print()}>PDF로 저장 / 인쇄</button>
        <span>인쇄 창에서 &lsquo;대상&rsquo;을 &lsquo;PDF로 저장&rsquo;으로 고르면 파일로 받을 수 있어요.</span>
      </div>

      <header className="rp-head">
        <p className="rp-brand">N.ROUND</p>
        <h1>{vote.title}</h1>
        <p className="rp-meta">
          {vote.category}
          {vote.deadline ? ` · ${fmtFull(vote.deadline)} 마감` : ""} · 응답 {rows.length} / {members.length}명
        </p>
      </header>

      {qs.map((q, qi) => (
        <section key={q.id} className="rp-q">
          <h2>
            {qi + 1}. {q.label}
          </h2>

          {q.type === "text" ? (
            <div className="rp-texts">
              {rows
                .map((r) => ({ r, t: answersOf(r)[q.id] }))
                .filter((x) => typeof x.t === "string" && (x.t as string).trim())
                .map(({ r, t }) => (
                  <div key={r.member_id} className="rp-text">
                    <b>{nameOf(r.member_id)}</b>
                    <span>{t as string}</span>
                  </div>
                ))}
              {rows.every((r) => {
                const t = answersOf(r)[q.id];
                return !(typeof t === "string" && t.trim());
              }) && <p className="rp-none">작성한 사람이 없어요.</p>}
            </div>
          ) : (
            <table className="rp-table">
              <thead>
                <tr>
                  <th style={{ width: "34%" }}>보기</th>
                  <th style={{ width: "12%" }}>인원</th>
                  <th>명단</th>
                </tr>
              </thead>
              <tbody>
                {q.options.map((o) => {
                  const who = pickedBy(rows, q, o);
                  return (
                    <tr key={o}>
                      <td className="rp-opt">{o}</td>
                      <td className="rp-num">{who.length}명</td>
                      <td className="rp-names">{who.map((r) => nameOf(r.member_id)).join(", ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {missing.length > 0 && (
        <section className="rp-q">
          <h2>미응답 {missing.length}명</h2>
          <p className="rp-missing">{missing.map((m) => m.name).join(", ")}</p>
        </section>
      )}

      <footer className="rp-foot">출력 {fmtFull(new Date().toISOString())}</footer>

      <style jsx global>{`
        body { background: #fff; }
        .rp {
          max-width: 760px;
          margin: 0 auto;
          padding: 28px 22px 60px;
          color: #241c18;
          font-family: "Pretendard", -apple-system, sans-serif;
        }
        .rp-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }
        .rp-actions button {
          background: #e94e3c;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .rp-actions span { font-size: 12px; color: #9b9391; }
        .rp-head { border-bottom: 2px solid #241c18; padding-bottom: 14px; }
        .rp-brand {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.2em;
          color: #e94e3c;
          margin: 0;
        }
        .rp-head h1 { font-size: 24px; font-weight: 800; margin: 8px 0 0; }
        .rp-meta { font-size: 13px; color: #6b6360; margin: 8px 0 0; }
        .rp-q { margin-top: 26px; page-break-inside: avoid; }
        .rp-q h2 { font-size: 15px; font-weight: 800; margin: 0 0 10px; }
        .rp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .rp-table th {
          text-align: left;
          font-weight: 700;
          color: #6b6360;
          border-bottom: 1px solid #e6e0de;
          padding: 7px 8px;
          font-size: 12px;
        }
        .rp-table td { border-bottom: 1px solid #f0eceb; padding: 9px 8px; vertical-align: top; }
        .rp-opt { font-weight: 700; }
        .rp-num { white-space: nowrap; color: #e94e3c; font-weight: 700; }
        .rp-names { color: #4a3f39; line-height: 1.6; }
        .rp-texts { display: flex; flex-direction: column; gap: 8px; }
        .rp-text {
          border-left: 3px solid #fde8e4;
          padding: 4px 0 4px 11px;
          font-size: 13px;
          line-height: 1.6;
        }
        .rp-text b { display: block; font-size: 12px; color: #6b6360; }
        .rp-none, .rp-missing { font-size: 13px; color: #6b6360; margin: 0; }
        .rp-foot { margin-top: 36px; font-size: 11px; color: #9b9391; }

        @media print {
          .rp-actions { display: none; }
          .rp { padding: 0; max-width: none; }
          @page { margin: 14mm; }
        }
      `}</style>
    </main>
  );
}

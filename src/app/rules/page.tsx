"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SubHeader } from "@/components/AppHeader";
import Icon from "@/components/Icon";

const ME_KEY = "nround_me_v1";

type Category = { id: string; name: string; sort_order: number };
type Rule = {
  id: string;
  category_id: string | null;
  title: string;
  body: string;
  version: number;
  requires_ack: boolean;
  sort_order: number;
  updated_at: string;
};
type Ack = { rule_id: string; version: number };
type Target = { rule_id: string; member_id: string };

export default function RulesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [acks, setAcks] = useState<Ack[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (memberId: string | null) => {
    setLoading(true);
    try {
      const [{ data: cs }, { data: rs }, { data: ts }] = await Promise.all([
        supabase.from("rule_categories").select("*").order("sort_order").order("created_at"),
        supabase.from("rules").select("*").eq("is_published", true).order("sort_order").order("created_at"),
        supabase.from("rule_targets").select("rule_id, member_id"),
      ]);

      setCategories((cs ?? []) as Category[]);

      // 대상이 지정된 규정은 지정된 사람에게만 보여줍니다.
      const allTargets = (ts ?? []) as Target[];
      const visible = ((rs ?? []) as Rule[]).filter((r) => {
        const forRule = allTargets.filter((t) => t.rule_id === r.id);
        if (forRule.length === 0) return true;
        return memberId ? forRule.some((t) => t.member_id === memberId) : false;
      });
      setRules(visible);

      if (memberId) {
        const { data: as } = await supabase
          .from("rule_acks")
          .select("rule_id, version")
          .eq("member_id", memberId);
        setAcks((as ?? []) as Ack[]);
      } else {
        setAcks([]);
      }
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(ME_KEY);
    setMeId(stored);
    load(stored);
  }, [load]);

  const hasAcked = useCallback(
    (r: Rule) => acks.some((a) => a.rule_id === r.id && a.version === r.version),
    [acks]
  );

  async function agree(r: Rule) {
    if (!meId) return;
    const { error: e } = await supabase
      .from("rule_acks")
      .insert({ rule_id: r.id, member_id: meId, version: r.version });
    if (e && e.code !== "23505") {
      setError("저장하지 못했어요.");
      return;
    }
    setAcks([...acks, { rule_id: r.id, version: r.version }]);
    setError("");
  }

  const todo = useMemo(() => rules.filter((r) => r.requires_ack && !hasAcked(r)), [rules, hasAcked]);

  const grouped = useMemo(() => {
    const out: { cat: Category | null; items: Rule[] }[] = [];
    categories.forEach((c) => {
      const items = rules.filter((r) => r.category_id === c.id);
      if (items.length) out.push({ cat: c, items });
    });
    const orphan = rules.filter((r) => !r.category_id || !categories.some((c) => c.id === r.category_id));
    if (orphan.length) out.push({ cat: null, items: orphan });
    return out;
  }, [categories, rules]);

  if (loading) {
    return (
      <main className="nr-page">
        <SubHeader title="크루 규정" />
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="nr-card" style={{ height: 62, opacity: 0.55 }} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="nr-page">
      <SubHeader title="크루 규정" />

      {error && <p className="text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      {meId && (
        <>
          {todo.length > 0 && (
            <div className="nr-card nr-card-tint mt-4 flex items-center gap-3 px-4 py-3.5">
              <span style={{ color: "var(--red-deep)" }}>
                <Icon name="alert" size={18} />
              </span>
              <div>
                <p className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>
                  확인이 필요한 규정 {todo.length}개
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
                  읽고 동의를 눌러주세요.
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-5">
            {grouped.map(({ cat, items }) => (
              <section key={cat?.id ?? "etc"}>
                <p className="nr-h2">{cat?.name ?? "기타"}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {items.map((r) => {
                    const acked = hasAcked(r);
                    const open = openId === r.id;
                    const needs = r.requires_ack && !acked;
                    return (
                      <div
                        key={r.id}
                        className="nr-card"
                        style={needs ? { borderColor: "var(--red-tint)" } : undefined}
                      >
                        <button
                          onClick={() => setOpenId(open ? null : r.id)}
                          className="flex w-full items-center gap-2 p-3.5 text-left"
                        >
                          <span className="flex-1 text-[14.5px] font-bold" style={{ color: "var(--ink)" }}>
                            {r.title}
                          </span>
                          {r.requires_ack &&
                            (acked ? (
                              <span className="text-[11px] font-bold" style={{ color: "var(--mint-text)" }}>
                                동의함
                              </span>
                            ) : (
                              <span className="nr-badge nr-badge-red">확인 필요</span>
                            ))}
                          <span
                            style={{
                              color: "var(--red-tint)",
                              transform: open ? "rotate(90deg)" : undefined,
                              transition: "transform .2s",
                            }}
                          >
                            <Icon name="chevron" size={16} />
                          </span>
                        </button>

                        {open && (
                          <div className="px-3.5 pb-3.5 pt-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                            <p
                              className="whitespace-pre-wrap text-[14px] leading-[1.75]"
                              style={{ color: "#4a3f39" }}
                            >
                              {r.body || "내용이 아직 없어요."}
                            </p>
                            <p className="mt-3 text-[10.5px]" style={{ color: "var(--muted)" }}>
                              v{r.version} · {r.updated_at.slice(0, 10)} 수정
                            </p>
                            {r.requires_ack &&
                              (acked ? (
                                <p
                                  className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold"
                                  style={{ color: "var(--mint-text)" }}
                                >
                                  <Icon name="check" size={14} /> 이 버전에 동의했어요
                                </p>
                              ) : (
                                <button onClick={() => agree(r)} className="nr-btn nr-btn-primary mt-3 py-3">
                                  읽었고 동의합니다
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {rules.length === 0 && (
              <div className="nr-empty">
                아직 등록된 규정이 없어요.
                <br />
                관리자 화면에서 첫 규정을 만들어보세요.
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

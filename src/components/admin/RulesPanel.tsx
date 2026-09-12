"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Member = { id: string; name: string; role: string | null };

const ROLE_ORDER: Record<string, number> = { lead: 0, sub_lead: 1, supporter: 2 };
function byRoleThenName(a: Member, b: Member) {
  const ra = a.role ? ROLE_ORDER[a.role] ?? 3 : 3;
  const rb = b.role ? ROLE_ORDER[b.role] ?? 3 : 3;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name, "ko");
}
type Category = { id: string; name: string; sort_order: number };
type Rule = {
  id: string;
  category_id: string | null;
  title: string;
  body: string;
  version: number;
  requires_ack: boolean;
  is_published: boolean;
  updated_at: string;
};
type Ack = { rule_id: string; member_id: string; version: number };
type Target = { rule_id: string; member_id: string };

const blank = {
  id: "",
  category_id: "",
  title: "",
  body: "",
  requires_ack: true,
  targetIds: [] as string[],
};

export default function RulesPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [acks, setAcks] = useState<Ack[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [catName, setCatName] = useState("");
  const [editing, setEditing] = useState<typeof blank | null>(null);
  const [bumpVersion, setBumpVersion] = useState(true);
  const [showAcksFor, setShowAcksFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ms }, { data: cs }, { data: rs }, { data: as }, { data: ts }] = await Promise.all([
        supabase.from("crew_members").select("id, name, role").eq("active", true).order("name"),
        supabase.from("rule_categories").select("*").order("sort_order").order("created_at"),
        supabase.from("rules").select("*").order("sort_order").order("created_at"),
        supabase.from("rule_acks").select("rule_id, member_id, version"),
        supabase.from("rule_targets").select("rule_id, member_id"),
      ]);
      setMembers(((ms ?? []) as Member[]).sort(byRoleThenName));
      setCategories((cs ?? []) as Category[]);
      setRules((rs ?? []) as Rule[]);
      setAcks((as ?? []) as Ack[]);
      setTargets((ts ?? []) as Target[]);
      setError("");
    } catch {
      setError("불러오지 못했어요.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const n = catName.trim();
    if (!n) return;
    await supabase.from("rule_categories").insert({ name: n, sort_order: categories.length });
    setCatName("");
    load();
  }

  async function removeCategory(id: string) {
    if (!confirm("이 카테고리를 지울까요?\n안에 있던 규정은 '기타'로 옮겨져요.")) return;
    await supabase.from("rule_categories").delete().eq("id", id);
    load();
  }

  async function saveTargets(ruleId: string, targetIds: string[]) {
    await supabase.from("rule_targets").delete().eq("rule_id", ruleId);
    if (targetIds.length > 0) {
      await supabase
        .from("rule_targets")
        .insert(targetIds.map((member_id) => ({ rule_id: ruleId, member_id })));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editing.title.trim()) return setError("제목을 입력해주세요.");

    const payload = {
      category_id: editing.category_id || null,
      title: editing.title.trim(),
      body: editing.body,
      requires_ack: editing.requires_ack,
      updated_at: new Date().toISOString(),
    };

    if (editing.id) {
      const current = rules.find((r) => r.id === editing.id);
      const nextVersion = bumpVersion ? (current?.version ?? 1) + 1 : current?.version ?? 1;
      const { error: e2 } = await supabase
        .from("rules")
        .update({ ...payload, version: nextVersion })
        .eq("id", editing.id);
      if (e2) return setError("저장하지 못했어요.");
      await saveTargets(editing.id, editing.targetIds);
    } else {
      const { data, error: e2 } = await supabase
        .from("rules")
        .insert({ ...payload, version: 1, sort_order: rules.length })
        .select("id")
        .single();
      if (e2 || !data) return setError("추가하지 못했어요.");
      await saveTargets(data.id, editing.targetIds);
    }

    setEditing(null);
    setBumpVersion(true);
    setError("");
    load();
  }

  async function remove(r: Rule) {
    if (!confirm(`"${r.title}" 규정을 삭제할까요?\n동의 기록도 함께 지워져요.`)) return;
    await supabase.from("rules").delete().eq("id", r.id);
    load();
  }

  async function togglePublished(r: Rule) {
    await supabase.from("rules").update({ is_published: !r.is_published }).eq("id", r.id);
    load();
  }

  function ackedNames(r: Rule) {
    const ids = acks.filter((a) => a.rule_id === r.id && a.version === r.version).map((a) => a.member_id);
    return members.filter((m) => ids.includes(m.id));
  }
  function targetedMembers(r: Rule) {
    const tg = targets.filter((t) => t.rule_id === r.id);
    if (tg.length === 0) return members;
    return members.filter((m) => tg.some((t) => t.member_id === m.id));
  }
  function pendingNames(r: Rule) {
    const done = ackedNames(r).map((m) => m.id);
    return targetedMembers(r).filter((m) => !done.includes(m.id));
  }

  function copyTagText(r: Rule) {
    const pending = pendingNames(r);
    const text =
      pending.map((m) => "@" + m.name).join(" ") + `\n[${r.title}] 규정 확인하고 동의 눌러주세요!`;
    navigator.clipboard.writeText(text);
  }

  if (loading) return <p className="nr-more">불러오는 중...</p>;

  return (
    <section>
      {error && <p className="mb-2 text-[12px]" style={{ color: "var(--red-deep)" }}>{error}</p>}

      <p className="nr-h2">카테고리</p>
      <form onSubmit={addCategory} className="mt-2 flex gap-2">
        <input
          value={catName}
          onChange={(e) => setCatName(e.target.value)}
          placeholder="예: 활동 규정, 회비 규정"
          className="nr-input flex-1"
        />
        <button type="submit" className="nr-btn-sm nr-btn-sm-solid px-4">추가</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <span key={c.id} className="nr-btn-sm flex items-center gap-1.5">
            {c.name}
            <button onClick={() => removeCategory(c.id)} style={{ color: "var(--red-tint)" }}>✕</button>
          </span>
        ))}
        {categories.length === 0 && (
          <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>아직 카테고리가 없어요.</span>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="nr-h2">규정 · 매뉴얼</p>
        {!editing && (
          <button
            onClick={() => {
              setEditing({ ...blank });
              setBumpVersion(true);
            }}
            className="nr-btn-sm nr-btn-sm-solid"
          >
            + 새 규정
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="nr-card mt-2 flex flex-col gap-2 p-3.5">
          <input
            autoFocus
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            placeholder="규정 제목"
            className="nr-input"
          />
          <select
            value={editing.category_id}
            onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}
            className="nr-input"
          >
            <option value="">카테고리 없음 (기타)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <textarea
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            rows={7}
            placeholder="내용을 적어주세요. 줄바꿈은 그대로 보여요."
            className="nr-input"
          />

          <div>
            <p className="nr-h2">누구에게 보여줄까요</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setEditing({ ...editing, targetIds: [] })}
                className={"nr-btn-sm " + (editing.targetIds.length === 0 ? "nr-btn-sm-solid" : "")}
              >
                전체
              </button>
              {members.map((m) => {
                const on = editing.targetIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        targetIds: on
                          ? editing.targetIds.filter((id) => id !== m.id)
                          : [...editing.targetIds, m.id],
                      })
                    }
                    className={"nr-btn-sm " + (on ? "nr-btn-sm-solid" : "")}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
              {editing.targetIds.length === 0
                ? "아무도 안 고르면 모두에게 보여요."
                : `${editing.targetIds
                    .map((id) => members.find((m) => m.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")} 님에게만 보여요.`}
            </p>
          </div>

          <label className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--ink)" }}>
            <input
              type="checkbox"
              checked={editing.requires_ack}
              onChange={(e) => setEditing({ ...editing, requires_ack: e.target.checked })}
            />
            크루원 동의가 필요한 규정
          </label>

          {editing.id && (
            <label
              className="flex items-start gap-2 rounded-xl p-2.5 text-[12.5px]"
              style={{ background: "var(--red-wash)", color: "var(--ink)" }}
            >
              <input
                type="checkbox"
                checked={bumpVersion}
                onChange={(e) => setBumpVersion(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <b>내용이 바뀌어 다시 동의받아야 해요</b>
                <br />
                <span style={{ color: "var(--muted)" }}>
                  체크하면 버전이 올라가고, 모두에게 다시 &apos;확인 필요&apos;로 표시돼요. 오타 수정처럼
                  사소한 변경이면 체크를 풀어주세요.
                </span>
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(null)} className="nr-btn nr-btn-ghost flex-1 py-2.5">
              취소
            </button>
            <button type="submit" className="nr-btn nr-btn-primary flex-1 py-2.5">저장</button>
          </div>
        </form>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {rules.map((r) => {
          const done = ackedNames(r);
          const pending = pendingNames(r);
          const showing = showAcksFor === r.id;
          const tg = targets.filter((t) => t.rule_id === r.id);
          return (
            <div key={r.id} className="nr-card p-4">
              <div className="flex items-center gap-2">
                <span
                  className="flex-1 text-[14.5px] font-bold"
                  style={{ color: r.is_published ? "var(--ink)" : "var(--muted)" }}
                >
                  {r.title}
                </span>
                <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>v{r.version}</span>
              </div>
              <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
                {categories.find((c) => c.id === r.category_id)?.name ?? "기타"}
                {!r.is_published && " · 숨김"}
                {r.requires_ack ? ` · 동의 ${done.length}/${targetedMembers(r).length}` : " · 동의 불필요"}
                {tg.length === 0
                  ? " · 전체 공개"
                  : ` · ${tg
                      .map((t) => members.find((m) => m.id === t.member_id)?.name)
                      .filter(Boolean)
                      .join(", ")} 전용`}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    setEditing({
                      id: r.id,
                      category_id: r.category_id ?? "",
                      title: r.title,
                      body: r.body,
                      requires_ack: r.requires_ack,
                      targetIds: targets.filter((t) => t.rule_id === r.id).map((t) => t.member_id),
                    });
                    setBumpVersion(true);
                  }}
                  className="nr-btn-sm"
                >
                  수정
                </button>
                {r.requires_ack && (
                  <button onClick={() => setShowAcksFor(showing ? null : r.id)} className="nr-btn-sm">
                    동의 현황
                  </button>
                )}
                {r.requires_ack && pending.length > 0 && (
                  <button onClick={() => copyTagText(r)} className="nr-btn-sm">미동의자 태그 복사</button>
                )}
                <button onClick={() => togglePublished(r)} className="nr-btn-sm">
                  {r.is_published ? "숨기기" : "보이기"}
                </button>
                <button
                  onClick={() => remove(r)}
                  className="nr-btn-sm"
                  style={{ borderColor: "transparent", background: "transparent" }}
                >
                  삭제
                </button>
              </div>

              {showing && (
                <div
                  className="mt-2 rounded-xl p-2.5 text-[11.5px] leading-relaxed"
                  style={{ background: "var(--red-wash)" }}
                >
                  <p style={{ color: "var(--mint-text)" }}>
                    동의: {done.length ? done.map((m) => m.name).join(", ") : "없음"}
                  </p>
                  <p className="mt-1" style={{ color: "var(--red-deep)" }}>
                    미동의: {pending.length ? pending.map((m) => m.name).join(", ") : "없음"}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        {rules.length === 0 && !editing && <p className="nr-empty">아직 규정이 없어요.</p>}
      </div>
    </section>
  );
}

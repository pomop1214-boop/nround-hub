export type QuestionType = "single" | "multi" | "text";

export type Question = {
  id: string;
  label: string;
  type: QuestionType;
  options: string[];
  /**
   * 이 보기를 고르면 뒤 질문은 answer 하지 않아도 됩니다.
   * (예: 첫 질문에서 "불참"을 고르면 날짜·활동은 물어볼 필요가 없음)
   */
  endsOn?: string[];
};

export type VoteRow = {
  id: string;
  title: string;
  category: string;
  options: string[] | null;
  questions: Question[] | null;
  deadline: string | null;
  is_open: boolean;
  created_at: string;
};

export type Answers = Record<string, string | string[] | undefined>;

export type ResponseRow = {
  vote_id: string;
  member_id: string;
  choice: string | null;
  answers: Answers | null;
};

/** 예전 구조(보기 목록만 있는 투표)도 질문 하나짜리로 읽어냅니다. */
export function questionsOf(v: VoteRow): Question[] {
  if (v.questions && v.questions.length > 0) return v.questions;
  return [{ id: "q1", label: "선택", type: "single", options: v.options ?? [] }];
}

/** 예전 응답(choice)도 새 형식으로 읽어냅니다. */
export function answersOf(r: ResponseRow | undefined): Answers {
  if (!r) return {};
  if (r.answers && Object.keys(r.answers).length > 0) return r.answers;
  return r.choice ? { q1: r.choice } : {};
}

/** 따로 정해두지 않았을 때 "안 간다"로 보는 말들 */
const DECLINE_WORDS = ["불참", "불가", "미참석", "참석 안", "안 감", "못 감", "안 갈", "못 갈"];

function isDecline(option: string) {
  const t = option.replace(/\s/g, "");
  return DECLINE_WORDS.some((w) => t.includes(w.replace(/\s/g, "")));
}

/** 첫 질문에서 "불참"류를 골랐다면 뒤 질문은 건너뜁니다. */
export function stopsAt(qs: Question[], a: Answers): number | null {
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (q.type !== "single") continue;
    const picked = a[q.id];
    if (typeof picked !== "string") continue;

    const ends = q.endsOn && q.endsOn.length > 0 ? q.endsOn.includes(picked) : isDecline(picked);
    if (ends) return i;
  }
  return null;
}

/** 지금 답안 기준으로 실제로 보여줄(물어볼) 질문들 */
export function visibleQuestions(qs: Question[], a: Answers): Question[] {
  const stop = stopsAt(qs, a);
  return stop === null ? qs : qs.slice(0, stop + 1);
}

/** 이 사람이 이 질문에 답했는지 */
export function isAnswered(a: Answers, q: Question) {
  const v = a[q.id];
  if (q.type === "multi") return Array.isArray(v) && v.length > 0;
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * 꼭 답해야 하는 질문에 다 답했는지.
 * 주관식은 선택이고, "불참"을 골랐다면 그 뒤 질문은 묻지 않습니다.
 */
export function isComplete(a: Answers, qs: Question[]) {
  return visibleQuestions(qs, a)
    .filter((q) => q.type !== "text")
    .every((q) => isAnswered(a, q));
}

/** 특정 보기를 고른 사람 수 */
export function pickedBy(rows: ResponseRow[], q: Question, option: string) {
  return rows.filter((r) => {
    const v = answersOf(r)[q.id];
    return q.type === "multi" ? Array.isArray(v) && v.includes(option) : v === option;
  });
}

export function newQuestionId() {
  return "q" + Math.random().toString(36).slice(2, 8);
}

export function fmtDeadline(iso: string) {
  const d = new Date(iso);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) 마감`;
}

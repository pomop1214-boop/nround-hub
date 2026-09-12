export type QuestionType = "single" | "multi" | "text";

export type Question = {
  id: string;
  label: string;
  type: QuestionType;
  options: string[];
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

/** 이 사람이 이 질문에 답했는지 */
export function isAnswered(a: Answers, q: Question) {
  const v = a[q.id];
  if (q.type === "multi") return Array.isArray(v) && v.length > 0;
  return typeof v === "string" && v.trim().length > 0;
}

/** 꼭 답해야 하는 질문(주관식 제외)에 다 답했는지 */
export function isComplete(a: Answers, qs: Question[]) {
  return qs.filter((q) => q.type !== "text").every((q) => isAnswered(a, q));
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

export type Settlement = {
  id: string;
  title: string;
  memo: string | null;
  due_date: string | null;
  is_open: boolean;
  created_at: string;
};

export type SettlementItem = {
  id: string;
  settlement_id: string;
  member_id: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  claimed_at: string | null;
};

export function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

/** 총액을 인원수로 나눕니다. 나머지는 앞사람부터 1원씩 더 냅니다. */
export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const rest = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0));
}

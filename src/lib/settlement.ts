export type Settlement = {
  id: string;
  title: string;
  memo: string | null;
  due_date: string | null;
  is_open: boolean;
  created_at: string;
  /** 입금받을 계좌 (비어 있으면 표시하지 않습니다) */
  account_bank?: string | null;
  account_number?: string | null;
  account_holder?: string | null;
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

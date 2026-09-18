/** 크루 공용 계좌 (회비는 항상 여기로 받습니다) */
export const CREW_ACCOUNT = {
  bank: "카카오뱅크",
  number: "3333315776031",
  holder: "N.ROUND 모임통장",
};

export type Account = { bank: string; number: string; holder: string };

export function hasAccount(a: Partial<Account> | null | undefined) {
  return !!a?.number && a.number.trim().length > 0;
}

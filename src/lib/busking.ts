export type Song = {
  type: "solo" | "duet";
  level: "상" | "중" | "하" | "";
  title: string;
  artist: string;
  reason: string;
  partner: string;
  instUrl: string | null;
  instName: string;
  /** 운영자가 무대에 올리기로 정한 곡 — 이 곡만 MR을 올립니다. */
  confirmed: boolean;
};

export type Submission = {
  id: string;
  round_id: string;
  created_at: string;
  name: string;
  member_id: string | null;
  status: "submitted" | "declined";
  experience: "first" | "experienced" | null;
  songs: Song[];
  admin_memo: string | null;
};

export type Round = {
  id: string;
  title: string;
  event_date: string | null;
  deadline: string | null;
  notice: string | null;
  is_open: boolean;
  created_at: string;
};

export const MIN_SONGS = 2;

export function emptySong(): Song {
  return {
    type: "solo",
    level: "",
    title: "",
    artist: "",
    reason: "",
    partner: "",
    instUrl: null,
    instName: "",
    confirmed: false,
  };
}

/** 조회수로 대중성 등급을 나눕니다(원래 앱과 같은 기준). */
export function levelFromViews(views: number): "상" | "중" | "하" {
  if (views >= 30_000_000) return "상";
  if (views >= 3_000_000) return "중";
  return "하";
}

export function isClosed(r: Round | null) {
  if (!r) return true;
  if (!r.is_open) return true;
  if (!r.deadline) return false;
  return new Date(r.deadline).getTime() <= Date.now();
}

export function fmtDeadline(iso: string) {
  const d = new Date(iso);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  let h = d.getHours();
  const ap = h < 12 ? "오전" : "오후";
  h = h % 12 || 12;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd}) ${ap} ${h}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 신청 단계에서는 제목만 있으면 됩니다. MR은 선곡된 뒤에 올립니다. */
export function songReady(s: Song) {
  return s.title.trim().length > 0;
}

export function canSubmit(songs: Song[]) {
  return songs.length >= MIN_SONGS && songs.every(songReady);
}

/** 선곡된 곡들 */
export function confirmedSongs(s: Submission | null) {
  return (s?.songs ?? []).filter((g) => g.confirmed);
}

/** MR을 아직 안 올린 선곡 곡이 있는지 */
export function needsInst(s: Submission | null) {
  return confirmedSongs(s).some((g) => !g.instUrl);
}

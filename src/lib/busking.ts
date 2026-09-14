export type Song = {
  type: "solo" | "duet";
  level: "상" | "중" | "하" | "";
  title: string;
  artist: string;
  reason: string;
  partner: string;
  instUrl: string | null;
  instName: string;
  confirmed: boolean;
};

export type Submission = {
  id: string;
  created_at: string;
  name: string;
  member_id: string | null;
  status: "submitted" | "declined";
  experience: "first" | "experienced" | null;
  songs: Song[];
  admin_memo: string | null;
};

export type BuskingConfig = {
  id: number;
  deadline: string | null;
  notice: string | null;
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

export function isClosed(cfg: BuskingConfig | null) {
  if (!cfg?.deadline) return false;
  return new Date(cfg.deadline).getTime() <= Date.now();
}

export function fmtDeadline(iso: string) {
  const d = new Date(iso);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  let h = d.getHours();
  const ap = h < 12 ? "오전" : "오후";
  h = h % 12 || 12;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd}) ${ap} ${h}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 제출 가능한 상태인지 — 곡마다 제목과 MR이 있어야 합니다. */
export function songReady(s: Song) {
  return s.title.trim().length > 0 && !!s.instUrl;
}

export function canSubmit(songs: Song[]) {
  return songs.length >= MIN_SONGS && songs.every(songReady);
}

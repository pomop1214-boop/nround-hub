"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// 기존 NewRoundwaiting 앱과 동일한 테이블/PIN을 그대로 씁니다.
// (같은 Supabase 프로젝트의 nround_queue 테이블, 단일 행 id=1)
const TABLE = "nround_queue";
const OPERATOR_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "1214";
const LS_KEY = "nround_queue_state_v1";
const DEV_KEY = "nround_device_v1";
const OP_KEY = "nround_operator_v1";

type Entry = { id: string; name: string; at: number; dev: string };
type QueueState = {
  nowSinging: Entry | null;
  waitlist: Entry[];
  history: Entry[];
  openAt: string | null;
};
type SheetType = null | "add" | "pin" | "schedule" | "clear" | "remove";

const EMPTY = (): QueueState => ({ nowSinging: null, waitlist: [], history: [], openAt: null });

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now() + "" + Math.random().toString(16).slice(2);
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtCd(msIn: number) {
  const ms = msIn < 0 ? 0 : msIn;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (d > 0 ? d + "일 " : "") + pad2(h) + ":" + pad2(m) + ":" + pad2(s);
}
function fmtWhen(ms: number) {
  const d = new Date(ms);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  let h = d.getHours();
  const ap = h < 12 ? "오전" : "오후";
  h = h % 12;
  if (h === 0) h = 12;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd}) ${ap} ${h}:${pad2(d.getMinutes())}`;
}
function toLocalInput(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}`;
}

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const common = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "users")
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  if (name === "lock")
    return (
      <svg {...common}>
        <rect x="4" y="11" width="16" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    );
  if (name === "clock")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  const paths: Record<string, string> = {
    x: "M18 6 6 18M6 6l12 12",
    check: "M20 6 9 17l-5-5",
    plus: "M12 5v14M5 12h14",
    chevron: "m9 18 6-6-6-6",
    trash: "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  };
  return (
    <svg {...common}>
      <path d={paths[name] || ""} />
    </svg>
  );
}

function MiniDisc() {
  return (
    <svg viewBox="0 0 40 40" width={30} height={30} aria-hidden="true">
      <g className="minidisc">
        <circle cx="20" cy="20" r="19" fill="#17120F" />
        <circle cx="20" cy="20" r="14" fill="none" stroke="#2b2420" strokeWidth={1} />
        <circle cx="20" cy="20" r="7.5" fill="#F25743" />
        <circle cx="20" cy="20" r="2" fill="#FFF8F5" />
        <path
          d="M20 2 A18 18 0 0 1 32 7"
          stroke="rgba(255,255,255,.14)"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function Turntable({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 200 188" width={170} height={160} style={{ display: "block", margin: "0 auto" }}>
      <ellipse cx="100" cy="180" rx="60" ry="7" fill="rgba(0,0,0,.12)" />
      <g className={"disc" + (playing ? " spin" : "")}>
        <circle cx="100" cy="98" r="80" fill="#17120F" />
        <circle cx="100" cy="98" r="72" fill="none" stroke="#2c2521" strokeWidth={1} />
        <circle cx="100" cy="98" r="64" fill="none" stroke="#221c19" strokeWidth={1} />
        <circle cx="100" cy="98" r="56" fill="none" stroke="#2c2521" strokeWidth={1} />
        <circle cx="100" cy="98" r="48" fill="none" stroke="#221c19" strokeWidth={1} />
        <circle cx="100" cy="98" r="40" fill="none" stroke="#2c2521" strokeWidth={1} />
        <path
          d="M100 18 A80 80 0 0 1 168 68"
          stroke="rgba(255,255,255,.10)"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="100" cy="98" r="27" fill="#F25743" />
        <circle cx="100" cy="98" r="27" fill="none" stroke="#FDCAC6" strokeWidth={1.5} opacity={0.55} />
        <circle cx="100" cy="98" r="13" fill="none" stroke="#FDCAC6" strokeWidth={1} opacity={0.4} />
        <circle cx="100" cy="98" r="4.5" fill="#FFF8F5" />
      </g>
      <g
        transform={playing ? "rotate(0 170 28)" : "rotate(-15 170 28)"}
        style={{ transition: "transform .5s cubic-bezier(.2,.8,.2,1)" }}
      >
        <line x1="170" y1="28" x2="84" y2="52" stroke="#ED9186" strokeWidth={5.5} strokeLinecap="round" />
        <line x1="170" y1="28" x2="185" y2="17" stroke="#ED9186" strokeWidth={9} strokeLinecap="round" />
        <rect x="74" y="44" width="20" height="14" rx="3.5" fill="#FDCAC6" transform="rotate(-16 84 51)" />
        <circle cx="170" cy="28" r="8.5" fill="#ED9186" />
        <circle cx="170" cy="28" r="3.4" fill="#FDCAC6" />
      </g>
    </svg>
  );
}

function SheetOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="sheet-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

function Row({
  n,
  entry,
  hi,
  myDev,
  isOp,
  onRemove,
}: {
  n: number;
  entry: Entry;
  hi: boolean;
  myDev: string;
  isOp: boolean;
  onRemove: (e: Entry) => void;
}) {
  const mine = entry.dev === myDev;
  const canRemove = isOp || mine;
  return (
    <div className={"row" + (hi ? " hi" : "")}>
      <div className="num">{n}</div>
      <div className="rname">{entry.name}</div>
      {mine && <span className="mine-tag">나</span>}
      {canRemove && (
        <button className="x" onClick={() => onRemove(entry)} aria-label="대기 취소">
          <Icon name="x" size={17} />
        </button>
      )}
    </div>
  );
}

export default function WaitingPage() {
  const [state, setState] = useState<QueueState>(EMPTY());
  const stateRef = useRef<QueueState>(EMPTY());
  const [mode, setMode] = useState<"local" | "supabase">("local");
  const modeRef = useRef<"local" | "supabase">("local");
  const [isOp, setIsOpState] = useState(false);
  const [myDev, setMyDev] = useState("");
  const [, forceTick] = useState(0);
  const timeOffsetRef = useRef(0);
  const prevNowIdRef = useRef<string | null>(null);
  const prevNextIdRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pinNextRef = useRef<(() => void) | null>(null);

  const [sheet, setSheet] = useState<SheetType>(null);
  const [removeTarget, setRemoveTarget] = useState<Entry | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [openAtInput, setOpenAtInput] = useState("");
  const [schedError, setSchedError] = useState(false);
  const [turnName, setTurnName] = useState<string | null>(null);
  const [nextBarName, setNextBarName] = useState<string | null>(null);

  function now() {
    return Date.now() + timeOffsetRef.current;
  }

  useEffect(() => {
    let dev = localStorage.getItem(DEV_KEY);
    if (!dev) {
      dev = uid();
      localStorage.setItem(DEV_KEY, dev);
    }
    setMyDev(dev);
    setIsOpState(localStorage.getItem(OP_KEY) === "1");

    function lsRead(): QueueState {
      try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? { ...EMPTY(), ...JSON.parse(raw) } : EMPTY();
      } catch {
        return EMPTY();
      }
    }

    async function syncServerTime() {
      try {
        const t0 = Date.now();
        const { data, error } = await supabase.rpc("get_server_time");
        if (error || !data) return;
        const t1 = Date.now();
        const server = new Date(data as string).getTime();
        if (!isNaN(server)) timeOffsetRef.current = server - Math.round((t0 + t1) / 2);
      } catch {
        /* optional rpc — fine if missing */
      }
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initStore() {
      try {
        const { data, error } = await supabase.from(TABLE).select("state").eq("id", 1).maybeSingle();
        if (error) throw error;
        const initial = data?.state ? { ...EMPTY(), ...(data.state as Partial<QueueState>) } : EMPTY();

        // 초기 로딩에서는 알림이 울리지 않도록 기준값을 먼저 맞춰둡니다.
        prevNowIdRef.current = initial.nowSinging?.id ?? null;
        prevNextIdRef.current = initial.waitlist[0]?.id ?? null;

        setState(initial);
        stateRef.current = initial;
        setMode("supabase");
        modeRef.current = "supabase";

        channel = supabase
          .channel("nround-queue")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: TABLE, filter: "id=eq.1" },
            (payload: { new?: { state?: Partial<QueueState> } }) => {
              if (payload.new?.state) {
                const next = { ...EMPTY(), ...payload.new.state };
                setState(next);
                stateRef.current = next;
              }
            }
          )
          .subscribe();

        syncServerTime();
      } catch (e) {
        console.warn("Supabase 연결 실패 — 로컬 모드로 전환:", e);
        const local = lsRead();
        prevNowIdRef.current = local.nowSinging?.id ?? null;
        prevNextIdRef.current = local.waitlist[0]?.id ?? null;
        setState(local);
        stateRef.current = local;
        setMode("local");
        modeRef.current = "local";
      }
    }

    initStore();

    const refetchInterval = setInterval(async () => {
      if (modeRef.current !== "supabase") return;
      try {
        const { data } = await supabase.from(TABLE).select("state").eq("id", 1).maybeSingle();
        if (data?.state) {
          const next = { ...EMPTY(), ...(data.state as Partial<QueueState>) };
          setState(next);
          stateRef.current = next;
        }
      } catch {
        /* backup sync — ignore transient errors */
      }
    }, 8000);

    const tickInterval = setInterval(() => forceTick((t) => t + 1), 500);

    function onVisibility() {
      if (document.hidden || modeRef.current !== "supabase") return;
      supabase
        .from(TABLE)
        .select("state")
        .eq("id", 1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.state) {
            const next = { ...EMPTY(), ...(data.state as Partial<QueueState>) };
            setState(next);
            stateRef.current = next;
          }
        });
      syncServerTime();
    }
    document.addEventListener("visibilitychange", onVisibility);

    function unlockAudio() {
      try {
        if (!audioCtxRef.current) {
          const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AC) audioCtxRef.current = new AC();
        }
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
      } catch {
        /* audio unlock best-effort */
      }
    }
    document.addEventListener("pointerdown", unlockAudio, { passive: true });
    document.addEventListener("touchstart", unlockAudio, { passive: true });

    return () => {
      clearInterval(refetchInterval);
      clearInterval(tickInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 내 항목이 무대/다음 차례가 되는 순간 알림
  useEffect(() => {
    const waiting = state.waitlist || [];
    const upNext = waiting[0] || null;
    const nowId = state.nowSinging?.id ?? null;
    const nextId = upNext?.id ?? null;

    if (nowId && nowId !== prevNowIdRef.current && state.nowSinging?.dev === myDev) {
      buzz([260, 120, 260, 120, 620]);
      chime();
      setTimeout(chime, 1300);
      setTimeout(chime, 2600);
      setTurnName(state.nowSinging.name);
    } else if (nextId && nextId !== prevNextIdRef.current && upNext?.dev === myDev) {
      buzz(150);
      setNextBarName(upNext.name);
      setTimeout(() => setNextBarName(null), 7000);
    }
    prevNowIdRef.current = nowId;
    prevNextIdRef.current = nextId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, myDev]);

  function chime() {
    const actx = audioCtxRef.current;
    if (!actx || actx.state !== "running") return;
    try {
      const t = actx.currentTime;
      (
        [
          [880, 0],
          [1174.66, 0.18],
          [880, 0.36],
          [1567.98, 0.54],
        ] as [number, number][]
      ).forEach(([freq, delay]) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t + delay);
        g.gain.exponentialRampToValueAtTime(0.4, t + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.17);
        o.connect(g);
        g.connect(actx.destination);
        o.start(t + delay);
        o.stop(t + delay + 0.22);
      });
    } catch {
      /* audio best-effort */
    }
  }
  function buzz(pattern: number | number[]) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch {
      /* vibration best-effort */
    }
  }

  async function mutate(fn: (s: QueueState) => QueueState) {
    if (modeRef.current === "supabase") {
      let latest = stateRef.current;
      try {
        const { data } = await supabase.from(TABLE).select("state").eq("id", 1).maybeSingle();
        latest = data?.state ? { ...EMPTY(), ...(data.state as Partial<QueueState>) } : EMPTY();
      } catch {
        /* fall back to last known state */
      }
      const next = fn(latest);
      setState(next);
      stateRef.current = next;
      try {
        await supabase.from(TABLE).update({ state: next }).eq("id", 1);
      } catch {
        /* best-effort write */
      }
    } else {
      const next = fn(stateRef.current);
      setState(next);
      stateRef.current = next;
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* storage best-effort */
      }
    }
  }

  function lockAt(): number | null {
    if (!state.openAt) return null;
    const t = new Date(state.openAt).getTime();
    if (isNaN(t)) return null;
    return now() < t ? t : null;
  }

  function addSinger(name: string) {
    const n = name.trim();
    if (!n || lockAt()) return;
    mutate((s) => ({ ...s, waitlist: [...s.waitlist, { id: uid(), name: n, at: Date.now(), dev: myDev }] }));
  }
  function advance() {
    mutate((s) => {
      const hist = s.nowSinging ? [s.nowSinging, ...s.history].slice(0, 40) : s.history;
      const [first = null, ...rest] = s.waitlist;
      return { ...s, nowSinging: first, waitlist: rest, history: hist };
    });
  }
  function removeWaiting(id: string) {
    mutate((s) => ({ ...s, waitlist: s.waitlist.filter((e) => e.id !== id) }));
  }
  function clearAll() {
    mutate(() => EMPTY());
  }
  function setOpenAtAction(iso: string | null) {
    mutate((s) => ({ ...s, openAt: iso }));
  }

  function setOp(v: boolean) {
    setIsOpState(v);
    try {
      if (v) localStorage.setItem(OP_KEY, "1");
      else localStorage.removeItem(OP_KEY);
    } catch {
      /* storage best-effort */
    }
  }
  function requireOp(then: () => void) {
    if (isOp) {
      then();
    } else {
      pinNextRef.current = then;
      setPinInput("");
      setPinError(false);
      setSheet("pin");
    }
  }
  function submitPin() {
    if (pinInput === OPERATOR_PIN) {
      setOp(true);
      setSheet(null);
      const go = pinNextRef.current;
      pinNextRef.current = null;
      if (go) go();
    } else {
      setPinError(true);
    }
  }

  function openAddSheet() {
    if (lockAt()) return;
    setNameInput("");
    setSheet("add");
  }
  function submitAdd() {
    if (!nameInput.trim()) return;
    addSinger(nameInput);
    setSheet(null);
  }

  function openScheduleSheet() {
    requireOp(() => {
      const cur = state.openAt ? new Date(state.openAt).getTime() : null;
      const curFuture = cur && !isNaN(cur) && cur > now() ? cur : null;
      setOpenAtInput(curFuture ? toLocalInput(curFuture) : "");
      setSchedError(false);
      setSheet("schedule");
    });
  }
  function submitSchedule() {
    const t = openAtInput ? new Date(openAtInput).getTime() : NaN;
    if (isNaN(t) || t <= now() + 20000) {
      setSchedError(true);
      return;
    }
    setOpenAtAction(new Date(t).toISOString());
    setSheet(null);
  }

  function openClearSheet() {
    requireOp(() => setSheet("clear"));
  }
  function openRemoveSheet(entry: Entry) {
    setRemoveTarget(entry);
    setSheet("remove");
  }

  const waiting = state.waitlist || [];
  const upNext = waiting[0] || null;
  const rest = waiting.slice(1);
  const playing = !!state.nowSinging;
  const oa = lockAt();
  const curFutureForSheet = (() => {
    const cur = state.openAt ? new Date(state.openAt).getTime() : null;
    return cur && !isNaN(cur) && cur > now() ? cur : null;
  })();

  return (
    <div className="page-bg">
      <div className="wrap">
        <header className="hdr">
          <div className="brand">
            <MiniDisc />
            <div>
              <div className="wordmark">N.ROUND</div>
              <div className="subtitle">부르기 대기열</div>
            </div>
          </div>
          <div className="hdr-btns">
            <button className={"icon-btn" + (isOp ? " op" : "")} onClick={openScheduleSheet} aria-label="오픈 예약">
              <Icon name="clock" size={16} />
            </button>
            <button className="icon-btn" onClick={openClearSheet} aria-label="전체 초기화">
              <Icon name="trash" size={16} />
            </button>
          </div>
        </header>

        {mode === "local" ? (
          <div className="mode local">
            <Icon name="users" size={14} /> 로컬 모드 · 이 기기에만 저장돼요. 다 같이 쓰려면 Supabase 연결을
            확인해주세요
          </div>
        ) : (
          <div className="mode">
            <Icon name="users" size={14} /> 실시간 공유 중
          </div>
        )}

        {oa ? (
          <section className="lock">
            <div className="lock-eyebrow">
              <Icon name="lock" size={13} /> 신청 오픈 전
            </div>
            <div className="cd">{fmtCd(oa - now())}</div>
            <div className="lock-when">{fmtWhen(oa)} 오픈</div>
            <div className="lock-sub">시간이 되면 이 화면에서 자동으로 열려요</div>
          </section>
        ) : (
          <section className={"stage " + (playing ? "on" : "off")}>
            {playing && state.nowSinging ? (
              <>
                <div className="eyebrow">
                  <span className="dot" />
                  NOW PLAYING
                </div>
                <div className="tt-wrap">
                  <Turntable playing={true} />
                </div>
                <div className="now-name">{state.nowSinging.name}</div>
                <button className="btn btn-cream" onClick={advance}>
                  <Icon name="check" size={18} /> 완료 — 다음 사람
                </button>
              </>
            ) : (
              <>
                <div className="eyebrow">
                  <span className="dot" />
                  무대 비어있음
                </div>
                <div className="tt-wrap">
                  <Turntable playing={false} />
                </div>
                <div className="stage-msg">
                  {upNext ? "다음 차례를 무대로 올려주세요" : "아직 대기 중인 사람이 없어요"}
                </div>
                <div className="stage-sub">
                  {upNext ? `${upNext.name} 님이 기다리고 있어요` : "아래 '부르기 신청'을 눌러 첫 곡을 시작해요"}
                </div>
                {upNext && (
                  <button className="btn btn-coral-flat" onClick={advance}>
                    다음 사람 올리기 <Icon name="chevron" size={17} />
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {upNext && (
          <div className="sec">
            <div className="label" style={{ marginBottom: 12 }}>
              다음 차례
            </div>
            <Row n={1} entry={upNext} hi myDev={myDev} isOp={isOp} onRemove={openRemoveSheet} />
          </div>
        )}

        <div className="sec">
          <div className="sec-head">
            <div className="label">대기 순서</div>
            <div className="count">
              <Icon name="users" size={13} /> {waiting.length}명 대기
            </div>
          </div>
          {rest.length === 0 ? (
            <div className="empty">
              {upNext ? "뒤에 기다리는 사람은 아직 없어요" : oa ? "오픈되면 여기서 신청을 받아요" : "대기 줄이 비어있어요"}
            </div>
          ) : (
            <div className="rows">
              {rest.map((e, i) => (
                <Row key={e.id} n={i + 2} entry={e} hi={false} myDev={myDev} isOp={isOp} onRemove={openRemoveSheet} />
              ))}
            </div>
          )}
        </div>
      </div>

      {!oa && (
        <div className="fab-wrap">
          <div className="fab-inner">
            <button className="fab" onClick={openAddSheet}>
              <Icon name="plus" size={20} /> 부르기 신청
            </button>
          </div>
        </div>
      )}

      {sheet === "add" && (
        <SheetOverlay onClose={() => setSheet(null)}>
          <div className="sheet-head">
            <div className="sheet-title">부르기 신청</div>
            <button className="sheet-x" onClick={() => setSheet(null)} aria-label="닫기">
              <Icon name="x" size={17} />
            </button>
          </div>
          <div className="field">
            <div className="flabel">이름</div>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitAdd();
                }
              }}
              placeholder="닉네임 또는 이름"
              autoComplete="off"
            />
          </div>
          <button className="btn btn-coral" style={{ marginTop: 6 }} onClick={submitAdd}>
            대기 줄에 추가
          </button>
        </SheetOverlay>
      )}

      {sheet === "pin" && (
        <SheetOverlay onClose={() => setSheet(null)}>
          <div className="sheet-head">
            <div className="sheet-title">운영자 확인</div>
            <button className="sheet-x" onClick={() => setSheet(null)} aria-label="닫기">
              <Icon name="x" size={17} />
            </button>
          </div>
          <p className="confirm-text">운영자만 쓸 수 있는 기능이에요. PIN을 입력해 주세요.</p>
          <div className="field">
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="PIN 숫자"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitPin();
                }
              }}
            />
          </div>
          {pinError && (
            <div className="form-err" style={{ display: "block" }}>
              PIN이 맞지 않아요
            </div>
          )}
          <button className="btn btn-coral" onClick={submitPin}>
            확인
          </button>
        </SheetOverlay>
      )}

      {sheet === "schedule" && (
        <SheetOverlay onClose={() => setSheet(null)}>
          <div className="sheet-head">
            <div className="sheet-title">신청 오픈 예약</div>
            <button className="sheet-x" onClick={() => setSheet(null)} aria-label="닫기">
              <Icon name="x" size={17} />
            </button>
          </div>
          {curFutureForSheet && (
            <div className="chip">
              <Icon name="clock" size={13} /> 예약됨 · {fmtWhen(curFutureForSheet)}
            </div>
          )}
          <p className="confirm-text">
            정한 시간이 되면 모두의 화면에서 자동으로 신청이 열려요. 그 전엔 카운트다운만 보여요.
          </p>
          <div className="field">
            <div className="flabel">오픈 날짜 · 시간</div>
            <input type="datetime-local" value={openAtInput} onChange={(e) => setOpenAtInput(e.target.value)} />
          </div>
          {schedError && (
            <div className="form-err" style={{ display: "block" }}>
              미래의 날짜·시간을 선택해 주세요
            </div>
          )}
          <div className="confirm-row">
            {curFutureForSheet && (
              <button
                className="btn-ghost"
                onClick={() => {
                  setOpenAtAction(null);
                  setSheet(null);
                }}
              >
                예약 해제
              </button>
            )}
            <button className="btn-warn" onClick={submitSchedule}>
              예약 저장
            </button>
          </div>
          <button
            className="oplink"
            onClick={() => {
              setOp(false);
              setSheet(null);
            }}
          >
            이 기기 운영자 해제
          </button>
        </SheetOverlay>
      )}

      {sheet === "clear" && (
        <SheetOverlay onClose={() => setSheet(null)}>
          <div className="sheet-head">
            <div className="sheet-title">전체 초기화</div>
            <button className="sheet-x" onClick={() => setSheet(null)} aria-label="닫기">
              <Icon name="x" size={17} />
            </button>
          </div>
          <p className="confirm-text">
            현재 무대와 대기 줄을 모두 비웁니다. 오픈 예약도 함께 지워져요. 되돌릴 수 없어요.
          </p>
          <div className="confirm-row">
            <button className="btn-ghost" onClick={() => setSheet(null)}>
              취소
            </button>
            <button
              className="btn-warn"
              onClick={() => {
                clearAll();
                setSheet(null);
              }}
            >
              초기화
            </button>
          </div>
        </SheetOverlay>
      )}

      {sheet === "remove" && removeTarget && (
        <SheetOverlay onClose={() => setSheet(null)}>
          <div className="sheet-head">
            <div className="sheet-title">대기 취소</div>
            <button className="sheet-x" onClick={() => setSheet(null)} aria-label="닫기">
              <Icon name="x" size={17} />
            </button>
          </div>
          <p className="confirm-text">
            <b style={{ color: "var(--text)" }}>{removeTarget.name}</b> 님을 대기열에서 뺄까요?
            <br />
            취소하면 다시 신청해서 맨 뒤부터 기다려야 해요.
          </p>
          <div className="confirm-row">
            <button className="btn-ghost" onClick={() => setSheet(null)}>
              돌아가기
            </button>
            <button
              className="btn-warn"
              onClick={() => {
                removeWaiting(removeTarget.id);
                setSheet(null);
                setRemoveTarget(null);
              }}
            >
              네, 뺄게요
            </button>
          </div>
        </SheetOverlay>
      )}

      {turnName && (
        <div className="turn-overlay">
          <div style={{ width: 170 }}>
            <Turntable playing={true} />
          </div>
          <div className="turn-big">지금 차례예요!</div>
          <div className="turn-name">{turnName} 님, 무대로 나와 주세요</div>
          <button className="turn-btn" onClick={() => setTurnName(null)}>
            확인
          </button>
        </div>
      )}

      {nextBarName && <div className="nextbar">곧 차례예요 — {nextBarName} 님이 다음 순서예요</div>}

      <style jsx global>{`
        .page-bg {
          --bg: #fff6f1;
          --card: #fff;
          --border: #f3ded7;
          --text: #241c18;
          --muted: #9c8c84;
          --coral: #f25743;
          --coral-deep: #e0492f;
          --coral-pale: #fff0eb;
          --mint: #ace1e5;
          --mint-bg: #e9f6f7;
          --mint-border: #c3e9ec;
          --mint-text: #2e7f87;
          --pink: #ed9186;
          --pink-soft: #fdcac6;
          --cream: #fff8f5;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }
        .wrap {
          max-width: 480px;
          margin: 0 auto;
          padding: 0 18px 220px;
        }
        .page-bg button {
          font-family: inherit;
        }
        .hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 26px 2px 14px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .wordmark {
          font-size: 19px;
          font-weight: 900;
          font-style: italic;
          letter-spacing: -0.03em;
          line-height: 1;
          color: var(--coral);
        }
        .subtitle {
          font-size: 12px;
          color: var(--muted);
          margin-top: 5px;
        }
        .hdr-btns {
          display: flex;
          gap: 8px;
        }
        .icon-btn {
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 9px;
          padding: 8px 9px;
          color: var(--muted);
          cursor: pointer;
          display: grid;
          place-items: center;
        }
        .icon-btn.op {
          color: var(--mint-text);
          border-color: var(--mint-border);
          background: var(--mint-bg);
        }
        .mode {
          margin: 0 2px 16px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 7px;
          font-weight: 600;
          color: var(--mint-text);
          background: var(--mint-bg);
          border: 1px solid var(--mint-border);
          border-radius: 10px;
          padding: 9px 12px;
        }
        .mode.local {
          color: #9a5b2e;
          background: #fff1e6;
          border-color: #f6d9be;
        }
        .stage {
          border-radius: 24px;
          overflow: hidden;
          padding: 22px 20px;
          transition: background 0.4s ease;
        }
        .stage.on {
          background: linear-gradient(165deg, #f4604d 0%, var(--coral-deep) 100%);
          box-shadow: 0 26px 58px -30px rgba(224, 73, 47, 0.6);
        }
        .stage.off {
          background: var(--coral-pale);
          border: 1px solid var(--pink-soft);
        }
        .eyebrow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }
        .stage.on .eyebrow {
          color: rgba(255, 255, 255, 0.92);
        }
        .stage.off .eyebrow {
          color: var(--muted);
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .stage.on .dot {
          background: #fff;
          box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.25);
          animation: pulse 1.4s ease-in-out infinite;
        }
        .stage.off .dot {
          background: var(--muted);
        }
        .tt-wrap {
          margin-top: 16px;
        }
        .stage.off .tt-wrap {
          opacity: 0.5;
        }
        .now-name {
          text-align: center;
          margin-top: 16px;
          font-size: 32px;
          font-weight: 900;
          font-style: italic;
          letter-spacing: -0.02em;
          color: #fff;
          line-height: 1.05;
          word-break: keep-all;
        }
        .stage-msg {
          text-align: center;
          margin-top: 14px;
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
        }
        .stage-sub {
          text-align: center;
          margin-top: 6px;
          font-size: 13.5px;
          color: var(--muted);
          line-height: 1.5;
        }
        .lock {
          border-radius: 24px;
          background: var(--coral-pale);
          border: 1px solid var(--pink-soft);
          padding: 28px 20px 26px;
          text-align: center;
        }
        .lock-eyebrow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.16em;
          color: var(--muted);
        }
        .cd {
          margin-top: 14px;
          font-size: 42px;
          font-weight: 900;
          font-style: italic;
          letter-spacing: 0.01em;
          color: var(--coral-deep);
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .lock-when {
          margin-top: 12px;
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
        }
        .lock-sub {
          margin-top: 5px;
          font-size: 12.5px;
          color: var(--muted);
        }
        .btn {
          width: 100%;
          border: none;
          border-radius: 14px;
          padding: 15px;
          font-size: 15.5px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }
        .btn-cream {
          background: var(--cream);
          color: var(--coral-deep);
          margin-top: 20px;
        }
        .btn-coral {
          background: linear-gradient(140deg, #f4604d, var(--coral-deep));
          color: #fff;
        }
        .btn-coral-flat {
          background: var(--coral);
          color: #fff;
          margin-top: 18px;
        }
        .label {
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.13em;
          color: var(--muted);
          padding: 0 2px;
        }
        .sec {
          margin-top: 22px;
        }
        .sec-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding: 0 2px;
        }
        .count {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12.5px;
          color: var(--muted);
          font-weight: 600;
        }
        .rows {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .row {
          display: flex;
          align-items: center;
          gap: 13px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 13px 13px 13px 14px;
        }
        .row.hi {
          background: var(--mint-bg);
          border-color: var(--mint-border);
        }
        .num {
          min-width: 26px;
          height: 26px;
          border-radius: 8px;
          background: #f4eae6;
          color: var(--muted);
          font-size: 13px;
          font-weight: 800;
          display: grid;
          place-items: center;
        }
        .row.hi .num {
          background: var(--mint);
          color: var(--mint-text);
        }
        .rname {
          flex: 1;
          min-width: 0;
          font-size: 15.5px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .row .x {
          background: transparent;
          border: none;
          color: var(--muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          display: grid;
          place-items: center;
        }
        .mine-tag {
          font-size: 10.5px;
          font-weight: 800;
          color: var(--mint-text);
          background: var(--mint);
          border-radius: 6px;
          padding: 2px 6px;
          flex: none;
        }
        .empty {
          border: 1px dashed var(--pink-soft);
          border-radius: 16px;
          padding: 26px 16px;
          text-align: center;
          color: var(--muted);
          font-size: 13.5px;
          line-height: 1.5;
          background: var(--coral-pale);
        }
        .fab-wrap {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 64px;
          padding: 14px 18px 10px;
          background: linear-gradient(to top, var(--bg) 70%, transparent);
          pointer-events: none;
          z-index: 20;
        }
        .fab-inner {
          max-width: 480px;
          margin: 0 auto;
          pointer-events: auto;
        }
        .fab {
          width: 100%;
          border: none;
          border-radius: 16px;
          padding: 16px;
          background: linear-gradient(140deg, #f4604d, var(--coral-deep));
          color: #fff;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 16px 34px -12px rgba(224, 73, 47, 0.55);
        }
        .sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(36, 28, 24, 0.45);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 50;
          animation: fadeIn 0.18s ease;
        }
        .sheet {
          width: 100%;
          max-width: 480px;
          background: var(--card);
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          padding: 10px 20px calc(24px + env(safe-area-inset-bottom));
          animation: sheetUp 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .grab {
          width: 38px;
          height: 4px;
          border-radius: 4px;
          background: #ebd9d1;
          margin: 0 auto 18px;
        }
        .sheet-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .sheet-title {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text);
        }
        .sheet-x {
          background: #f4eae6;
          border: none;
          border-radius: 9px;
          padding: 7px;
          color: var(--muted);
          cursor: pointer;
          display: grid;
          place-items: center;
        }
        .field {
          margin-bottom: 15px;
        }
        .flabel {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--muted);
          margin-bottom: 8px;
        }
        .page-bg input {
          width: 100%;
          box-sizing: border-box;
          background: #fbf3ef;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
          color: var(--text);
          font-size: 16px;
          outline: none;
          font-family: inherit;
        }
        .page-bg input::placeholder {
          color: var(--muted);
          opacity: 0.7;
        }
        .page-bg input:focus {
          border-color: var(--coral);
        }
        .confirm-text {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
          margin: 0 0 18px;
        }
        .confirm-row {
          display: flex;
          gap: 10px;
        }
        .btn-ghost {
          flex: 1;
          border: 1px solid var(--border);
          border-radius: 13px;
          padding: 14px;
          background: transparent;
          color: var(--text);
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-warn {
          flex: 1;
          border: none;
          border-radius: 13px;
          padding: 14px;
          background: var(--coral);
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
        }
        .form-err {
          color: var(--coral-deep);
          font-size: 13px;
          font-weight: 600;
          margin: -6px 0 14px;
        }
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--mint-bg);
          border: 1px solid var(--mint-border);
          color: var(--mint-text);
          font-size: 13px;
          font-weight: 700;
          border-radius: 10px;
          padding: 8px 12px;
          margin-bottom: 14px;
        }
        .oplink {
          display: block;
          margin: 16px auto 0;
          background: none;
          border: none;
          color: var(--muted);
          font-size: 12.5px;
          text-decoration: underline;
          cursor: pointer;
        }
        .turn-overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: linear-gradient(165deg, #f4604d, #e0492f);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px 24px;
          text-align: center;
          animation: fadeIn 0.2s ease;
        }
        .turn-big {
          margin-top: 20px;
          font-size: 42px;
          font-weight: 900;
          font-style: italic;
          letter-spacing: -0.02em;
          color: #fff;
          line-height: 1.1;
        }
        .turn-name {
          margin-top: 12px;
          font-size: 18px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.94);
        }
        .turn-btn {
          margin-top: 34px;
          border: none;
          border-radius: 16px;
          background: #fff8f5;
          color: var(--coral-deep);
          font-size: 16px;
          font-weight: 800;
          padding: 15px 46px;
          cursor: pointer;
        }
        .nextbar {
          position: fixed;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 70;
          background: var(--mint-bg);
          border: 1px solid var(--mint-border);
          color: var(--mint-text);
          font-size: 13.5px;
          font-weight: 700;
          padding: 11px 16px;
          border-radius: 14px;
          box-shadow: 0 10px 26px -12px rgba(46, 127, 135, 0.45);
          max-width: calc(100% - 36px);
          animation: dropIn 0.3s ease;
        }
        .disc.spin {
          animation: nr-spin 3.2s linear infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .minidisc {
          animation: nr-spin 9s linear infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes nr-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
        @keyframes sheetUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes dropIn {
          from {
            transform: translate(-50%, -16px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .page-bg * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

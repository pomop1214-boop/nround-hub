/** 홈 상단 배너 — 시안의 레코드 + 톤암 + CTA */
export default function Hero() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-5 pb-5 pt-7"
      style={{ background: "linear-gradient(140deg, #EF5643 0%, #DA3F2D 100%)" }}
    >
      <svg
        viewBox="0 0 340 230"
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {/* 왼쪽 위 레코드 — 민트 라벨이 살짝 걸침 */}
        <g className="nr-disc-spin">
          <circle cx="14" cy="8" r="86" fill="#A9DCE0" opacity="0.85" />
          <circle cx="14" cy="8" r="70" fill="none" stroke="rgba(255,255,255,.30)" strokeWidth="1.2" />
        </g>

        {/* 큰 레코드 그루브 */}
        <g className="nr-disc-spin">
          {[120, 148, 176, 204, 232, 260].map((r) => (
            <circle
              key={r}
              cx="14"
              cy="8"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,.13)"
              strokeWidth="1.2"
            />
          ))}
        </g>

        {/* 톤암 */}
        <g opacity="0.55">
          <line x1="330" y1="150" x2="150" y2="196" stroke="#FBD9D3" strokeWidth="7" strokeLinecap="round" />
          <rect x="138" y="186" width="22" height="15" rx="4" fill="#FDE8E4" transform="rotate(-14 149 193)" />
          <circle cx="332" cy="149" r="9" fill="#FBD9D3" />
        </g>
      </svg>

      <div className="relative text-center">
        <p
          className="text-[10px] font-bold tracking-[0.35em]"
          style={{ color: "rgba(255,255,255,.85)" }}
        >
          VOCAL CREW
        </p>
        <p className="nr-wordmark mt-2.5" style={{ fontSize: 38, color: "#fff" }}>
          N.ROUND
        </p>
        <p className="mt-2.5 text-[13px]" style={{ color: "rgba(255,255,255,.95)" }}>
          함께 부르는, 새로운 라운드.
        </p>

        <div className="mt-4 flex justify-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold"
            style={{ background: "#fff", color: "var(--red)" }}
          >
            오늘도 한 걸음 더
            <span aria-hidden="true">→</span>
          </span>
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block rounded-full"
              style={{
                width: 5,
                height: 5,
                background: i === 0 ? "#fff" : "rgba(255,255,255,.45)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

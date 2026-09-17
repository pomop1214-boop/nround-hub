/** 생일 당일에만 홈 맨 위에 뜨는 축하 배너 */
export default function BirthdayBanner({ name }: { name: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-5 py-6 text-center"
      style={{ background: "linear-gradient(140deg, #EF5643 0%, #DA3F2D 100%)" }}
    >
      {/* 색종이 조각 */}
      <svg
        viewBox="0 0 300 170"
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ opacity: 0.55 }}
      >
        <circle cx="26" cy="28" r="3" fill="#FFD9A0" />
        <circle cx="270" cy="36" r="3.5" fill="#A9DCE0" />
        <circle cx="54" cy="130" r="2.6" fill="#FFF0B3" />
        <circle cx="248" cy="124" r="3" fill="#FDCAC6" />
        <rect x="88" y="16" width="4" height="9" rx="2" fill="#FFE3A3" transform="rotate(22 90 20)" />
        <rect x="206" y="134" width="4" height="9" rx="2" fill="#A9DCE0" transform="rotate(-18 208 138)" />
        <rect x="152" y="8" width="3.6" height="8" rx="1.8" fill="#FDCAC6" transform="rotate(-30 154 12)" />
        <rect x="34" y="88" width="3.4" height="8" rx="1.7" fill="#A9DCE0" transform="rotate(40 36 92)" />
      </svg>

      <div className="relative">
        <p className="nr-cake" style={{ fontSize: 34, lineHeight: 1 }}>
          🎂
        </p>
        <p className="mt-2.5 text-[19px] font-extrabold leading-snug" style={{ color: "#fff" }}>
          {name} 님,
          <br />
          생일 축하해요!
        </p>
        <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "rgba(255,255,255,.92)" }}>
          오늘 하루 행복하게 보내세요.
          <br />
          N.ROUND 크루 일동
        </p>
      </div>
    </div>
  );
}

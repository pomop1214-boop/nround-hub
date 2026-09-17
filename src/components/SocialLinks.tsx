const IG_BG = "linear-gradient(135deg,#F9CE34 0%,#EE2A7B 50%,#6228D7 100%)";

/** 상단바용 채널 아이콘. size 로 크기를 조절합니다. */
export default function SocialLinks({
  size = 26,
  divider = true,
}: {
  size?: number;
  divider?: boolean;
}) {
  const inner = Math.round(size * 0.58);
  const radius = Math.round(size * 0.29);

  return (
    <>
      <a
        href="https://www.instagram.com/we_new_round"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="N.ROUND 인스타그램"
        className="grid place-items-center"
        style={{ width: size, height: size, borderRadius: radius, background: IG_BG, flex: "none" }}
      >
        <svg viewBox="0 0 24 24" width={inner} height={inner} aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#fff" strokeWidth="2.1" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="2.1" />
          <circle cx="17.2" cy="6.8" r="1.4" fill="#fff" />
        </svg>
      </a>

      <a
        href="https://youtube.com/@new_round"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="N.ROUND 유튜브"
        className="grid place-items-center"
        style={{ width: size, height: size, borderRadius: radius, background: "#FF0000", flex: "none" }}
      >
        <svg viewBox="0 0 24 24" width={inner} height={inner} aria-hidden="true">
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="#fff" />
          <path d="M10.2 9.2v5.6l4.8-2.8z" fill="#FF0000" />
        </svg>
      </a>

      {divider && (
        <span style={{ width: 1, height: 17, background: "var(--border)", flex: "none" }} />
      )}
    </>
  );
}

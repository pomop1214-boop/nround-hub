const IG_BG = "linear-gradient(135deg,#F9CE34 0%,#EE2A7B 50%,#6228D7 100%)";

/** 상단바용 작은 채널 아이콘 */
export default function SocialLinks() {
  return (
    <>
      <a
        href="https://www.instagram.com/we_new_round"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="N.ROUND 인스타그램"
        className="grid place-items-center rounded-md"
        style={{ width: 22, height: 22, background: IG_BG, flex: "none" }}
      >
        <svg viewBox="0 0 24 24" width={13} height={13} aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#fff" strokeWidth="2.2" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="2.2" />
          <circle cx="17.2" cy="6.8" r="1.4" fill="#fff" />
        </svg>
      </a>

      <a
        href="https://youtube.com/@new_round"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="N.ROUND 유튜브"
        className="grid place-items-center rounded-md"
        style={{ width: 22, height: 22, background: "#FF0000", flex: "none" }}
      >
        <svg viewBox="0 0 24 24" width={13} height={13} aria-hidden="true">
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="#fff" />
          <path d="M10.2 9.2v5.6l4.8-2.8z" fill="#FF0000" />
        </svg>
      </a>

      {/* 채널 링크와 내 알림 영역을 나눕니다 */}
      <span style={{ width: 1, height: 16, background: "var(--border)", flex: "none" }} />
    </>
  );
}

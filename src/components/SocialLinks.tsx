const LINKS = [
  {
    name: "인스타그램",
    href: "https://www.instagram.com/we_new_round",
    bg: "linear-gradient(135deg,#F9CE34 0%,#EE2A7B 50%,#6228D7 100%)",
    // 인스타그램 마크
    path: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" />
      </>
    ),
  },
  {
    name: "유튜브",
    href: "https://youtube.com/@new_round",
    bg: "#FF0000",
    // 유튜브 마크
    path: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="#fff" />
        <path d="M10.2 9.2v5.6l4.8-2.8z" fill="#FF0000" />
      </>
    ),
  },
];

/** 홈에서 크루 채널로 바로 가는 버튼 */
export default function SocialLinks() {
  return (
    <section className="mt-6">
      <h2 className="nr-h2">N.ROUND 채널</h2>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {LINKS.map((l) => (
          <a
            key={l.name}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="nr-card flex items-center gap-2.5 p-3.5"
          >
            <span
              className="grid place-items-center rounded-xl"
              style={{ width: 36, height: 36, background: l.bg, flex: "none" }}
            >
              <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
                {l.path}
              </svg>
            </span>
            <span className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>
              {l.name}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

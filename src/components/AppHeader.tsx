import Link from "next/link";
import Icon from "./Icon";

/** 시안의 상단 바 — 워드마크 + 알림 */
export default function AppHeader({ name }: { name?: string }) {
  return (
    <header className="flex items-center justify-between pb-4 pt-6">
      <Link href="/">
        <span className="nr-wordmark block" style={{ fontSize: 21 }}>
          N.ROUND
        </span>
      </Link>
      <div className="flex items-center gap-2.5">
        <span style={{ color: "var(--body)" }}>
          <Icon name="bell" size={20} />
        </span>
        <Link
          href="/me"
          className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold"
          style={{ background: "var(--red-tint)", color: "var(--red-deep)" }}
          aria-label="마이 페이지"
        >
          {name ? name.slice(0, 1) : <Icon name="user" size={16} />}
        </Link>
      </div>
    </header>
  );
}

/** 하위 화면용 — 뒤로가기 + 가운데 제목 */
export function SubHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2 pb-4 pt-6">
      <Link href="/" style={{ color: "var(--body)", transform: "rotate(180deg)" }}>
        <Icon name="chevron" size={20} />
      </Link>
      <p className="flex-1 text-center text-[16px] font-extrabold" style={{ color: "var(--ink)" }}>
        {title}
      </p>
      <div style={{ minWidth: 20 }} className="flex justify-end">
        {right}
      </div>
    </header>
  );
}

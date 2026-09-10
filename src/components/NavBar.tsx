"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const items = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/vote", label: "투표", icon: "chart" },
  { href: "/waiting", label: "캐치마이크", icon: "mic" },
  { href: "/rules", label: "규정", icon: "doc" },
  { href: "/me", label: "마이", icon: "user" },
];

export default function NavBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30"
      style={{
        background: "#fff",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto flex max-w-[480px] px-1 py-1.5">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-1 py-1.5"
              style={{ color: active ? "var(--red)" : "var(--muted)" }}
            >
              <Icon name={item.icon} size={20} />
              <span style={{ fontSize: 10, fontWeight: active ? 800 : 600 }}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

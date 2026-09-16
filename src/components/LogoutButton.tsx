"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "./Icon";

export default function LogoutButton() {
  const router = useRouter();
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    fetch("/api/change-password")
      .then((r) => r.json())
      .then((d) => setMustChange(!!d.mustChange))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    localStorage.removeItem("nround_me_v1");
    localStorage.removeItem("nround_me_name");
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {mustChange && (
        <Link href="/password" className="nr-card nr-card-tint mt-6 flex items-center gap-3 p-4">
          <span style={{ color: "var(--red)" }}>
            <Icon name="alert" size={18} />
          </span>
          <span className="flex-1">
            <span className="block text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>
              임시 비밀번호를 쓰고 있어요
            </span>
            <span className="mt-0.5 block text-[12px]" style={{ color: "var(--muted)" }}>
              나만 아는 비밀번호로 바꿔주세요
            </span>
          </span>
          <span style={{ color: "var(--muted)" }}>
            <Icon name="chevron" size={16} />
          </span>
        </Link>
      )}

    </>
  );
}

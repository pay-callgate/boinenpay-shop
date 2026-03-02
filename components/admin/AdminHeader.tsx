"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

/**
 * T1-4: 파트너 어드민 헤더 (TRD §3.5)
 * h-14, bg-black, text-white. 좌측 로고, 우측 링크(계정정보, 로그아웃)
 * 중앙 집중형: /admin 기준 링크만 사용.
 */
export function AdminHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-black px-4 text-white">
      <Link href="/admin" className="text-lg font-bold">
        Partner Admin
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-300">|</span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="hover:underline"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}

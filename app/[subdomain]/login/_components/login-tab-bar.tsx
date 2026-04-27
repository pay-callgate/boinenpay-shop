import Link from "next/link";
import type { ShopLoginTab } from "./login-tab-bar-types";

export type { ShopLoginTab } from "./login-tab-bar-types";

type Props = {
  subdomain: string;
  /** 예: callbackUrl=https%3A%2F%2F... */
  searchQuery: string;
  active: ShopLoginTab;
};

export function LoginTabBar({ subdomain, searchQuery, active }: Props) {
  const q = searchQuery ? `?${searchQuery}` : "";
  const memberHref = `/${subdomain}/login${q}`;
  const guestHref = `/${subdomain}/login/guest${q}`;

  const baseInactive = "text-slate-600 hover:text-slate-900";
  const baseActive = "bg-slate-900 text-white shadow-md";

  return (
    <div
      className="flex rounded-xl bg-slate-100/90 p-1 shadow-inner"
      role="tablist"
      aria-label="로그인 방식"
    >
      <Link
        href={memberHref}
        role="tab"
        aria-selected={active === "member"}
        className={`flex-1 rounded-lg py-3 text-center text-sm font-semibold transition-all duration-200 ${
          active === "member" ? baseActive : baseInactive
        }`}
      >
        기존 회원
      </Link>
      <Link
        href={guestHref}
        role="tab"
        aria-selected={active === "guest"}
        className={`flex-1 rounded-lg py-3 text-center text-sm font-semibold transition-all duration-200 ${
          active === "guest" ? baseActive : baseInactive
        }`}
      >
        비회원 주문조회
      </Link>
    </div>
  );
}

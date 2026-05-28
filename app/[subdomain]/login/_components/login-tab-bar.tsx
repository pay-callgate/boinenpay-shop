import Link from "next/link";
import { buildShopLoginQuery } from "../_lib/shop-login-query";
import type { ShopLoginTab } from "./login-tab-bar-types";

export type { ShopLoginTab } from "./login-tab-bar-types";

type Props = {
  subdomain: string;
  callbackUrl: string;
  active: ShopLoginTab;
  /** 탭 전환 시 orderNo·clientSlug 등 비회원 조회 자동입력 유지 */
  preserveSearchParams?: URLSearchParams | null;
};

export function LoginTabBar({
  subdomain,
  callbackUrl,
  active,
  preserveSearchParams,
}: Props) {
  const memberQ = buildShopLoginQuery(callbackUrl, "member", preserveSearchParams);
  const guestQ = buildShopLoginQuery(callbackUrl, "guest", preserveSearchParams);
  const memberHref = `/${subdomain}/login?${memberQ}`;
  const guestHref = `/${subdomain}/login?${guestQ}`;

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

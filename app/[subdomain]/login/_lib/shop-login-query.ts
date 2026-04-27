import type { ShopLoginTab } from "../_components/login-tab-bar-types";

/** 통합 로그인 허브 쿼리 (?callbackUrl=…&tab=guest) */
export function buildShopLoginQuery(callbackUrl: string, tab: ShopLoginTab): string {
  const p = new URLSearchParams();
  p.set("callbackUrl", callbackUrl);
  if (tab === "guest") p.set("tab", "guest");
  return p.toString();
}

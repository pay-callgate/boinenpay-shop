import type { ShopLoginTab } from "../_components/login-tab-bar-types";

const GUEST_LOOKUP_PRESERVE_KEYS = ["clientSlug", "client", "orderNo", "ordererName"] as const;

/** 통합 로그인 허브 쿼리 (?callbackUrl=…&tab=guest) — 비회원 조회 자동입력 파라미터 유지 */
export function buildShopLoginQuery(
  callbackUrl: string,
  tab: ShopLoginTab,
  preserve?: URLSearchParams | null
): string {
  const p = new URLSearchParams();
  p.set("callbackUrl", callbackUrl);
  if (tab === "guest") p.set("tab", "guest");
  if (preserve) {
    for (const key of GUEST_LOOKUP_PRESERVE_KEYS) {
      const v = preserve.get(key)?.trim();
      if (!v) continue;
      if (key === "client") {
        if (!preserve.get("clientSlug")?.trim()) {
          p.set("clientSlug", v);
        }
      } else if (!p.has(key)) {
        p.set(key, v);
      }
    }
  }
  return p.toString();
}

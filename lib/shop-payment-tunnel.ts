/**
 * 결제 터널 경로: 하단 탭 네비 비표시, 메인 하단 패딩 제거, 결제 CTA는 safe-area 기준.
 * /{subdomain}/{clientSlug}/checkout | guest-order | order/complete
 */
export function isShopPaymentTunnelPath(pathname: string): boolean {
  if (!pathname) return false;
  const n = pathname.replace(/\/$/, "") || "/";
  const parts = n.split("/").filter(Boolean);
  if (parts.length < 3) return false;
  const rest = parts.slice(2);
  const first = rest[0];
  if (first === "checkout" || first === "guest-order") return true;
  return first === "order" && rest[1] === "complete";
}

/** 회원/비회원 주문서만 — 카카오 인앱 → 시스템 브라우저 이탈 대상 */
export function isCheckoutKakaoEscapePath(pathname: string): boolean {
  if (!pathname) return false;
  const n = pathname.replace(/\/$/, "") || "/";
  const parts = n.split("/").filter(Boolean);
  if (parts.length < 3) return false;
  const seg = parts[2];
  return seg === "checkout" || seg === "guest-order";
}

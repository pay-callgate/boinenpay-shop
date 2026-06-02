/** checkout-guard API 및 클라이언트 가이드 UI 공통 타입 */

export type CheckoutGuardScenario = "paid" | "pending" | "none" | "no_identity";

export type CheckoutResumeOrderPreview = {
  primaryProductName: string;
  thumbnailUrl: string | null;
  lineCount: number;
  displayTitle: string;
};

export type CheckoutResumeOrder = {
  id: string;
  orderNo: string;
  totalAmount: number;
  isGuest: boolean;
  guestCheckoutToken?: string;
  paymentSignature?: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  /** pending 주문 생성 시 cart_items.id 스냅샷 — 장바구니 불일치 경고용 */
  checkoutCartItemIds?: string[];
  /** order_items + products 미리보기 (checkout-guard) */
  preview?: CheckoutResumeOrderPreview;
};

export type CheckoutGuardApiResponse = {
  scenario: CheckoutGuardScenario;
  paymentStatus: string | null;
  order?: CheckoutResumeOrder;
  completePath?: string;
};

export type CheckoutGuardPhase =
  | "idle"
  | "loading"
  | "pending_offer"
  | "paid_notice"
  /** @deprecated paid 자동 리다이렉트 제거 — paid_notice 사용 */
  | "paid_redirect"
  /** @deprecated pending_offer 사용 */
  | "pending"
  | "empty";

export type CheckoutGuardState = {
  phase: CheckoutGuardPhase;
  pendingOrder: CheckoutResumeOrder | null;
  completePath?: string | null;
};

export const CHECKOUT_GUARD_INITIAL: CheckoutGuardState = {
  phase: "idle",
  pendingOrder: null,
  completePath: null,
};

export function buildShopHomePath(subdomain: string, clientSlug: string): string {
  return `/${subdomain}/${clientSlug}`;
}

export function buildShopCartPath(subdomain: string, clientSlug: string): string {
  return `/${subdomain}/${clientSlug}/cart`;
}

/** checkout-guard API 및 클라이언트 가이드 UI 공통 타입 */

export type CheckoutGuardScenario = "paid" | "pending" | "none" | "no_identity";

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
  | "paid_redirect"
  | "pending"
  | "empty";

export type CheckoutGuardState = {
  phase: CheckoutGuardPhase;
  pendingOrder: CheckoutResumeOrder | null;
};

export const CHECKOUT_GUARD_INITIAL: CheckoutGuardState = {
  phase: "idle",
  pendingOrder: null,
};

export function buildShopHomePath(subdomain: string, clientSlug: string): string {
  return `/${subdomain}/${clientSlug}`;
}

export function buildShopCartPath(subdomain: string, clientSlug: string): string {
  return `/${subdomain}/${clientSlug}/cart`;
}

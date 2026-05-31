import type { CheckoutGuardScenario } from "./viewpay-checkout-context";
import { isRecentlyPaidOrder, isRecentlyPendingOrder } from "./viewpay-sync-status";

type RecentOrder = {
  payment_status: string;
  updated_at?: string | null;
  created_at?: string | null;
};

/** checkout-guard API 분기 (단위 테스트용) */
export function resolveCheckoutGuardScenario(
  order: RecentOrder | null,
  hasIdentity: boolean,
  nowMs = Date.now()
): CheckoutGuardScenario {
  if (!hasIdentity) return "no_identity";
  if (!order) return "none";
  if (isRecentlyPaidOrder(order, nowMs)) return "paid";
  if (isRecentlyPendingOrder(order, nowMs)) return "pending";
  return "none";
}

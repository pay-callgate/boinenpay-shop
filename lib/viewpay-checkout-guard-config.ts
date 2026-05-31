/**
 * checkout/guest-order CheckoutGuard 동작 플래그
 */

/** Pending 조회 + 선택형 패널 (최근 1건) */
export const VIEWPAY_CHECKOUT_GUARD_PENDING_PROBE_ENABLED = true;

/** paid 시 router.replace 자동 이동 — OFF (고객이 직접 complete 이동) */
export const VIEWPAY_CHECKOUT_GUARD_PAID_AUTO_REDIRECT_ENABLED = false;

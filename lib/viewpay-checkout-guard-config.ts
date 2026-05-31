/**
 * checkout/guest-order CheckoutGuard — PG 승인·webhook 반영 전 클라이언트 리다이렉트 금지.
 * true 로 켜면 paid → complete / pending 가이드가 다시 동작합니다.
 */
export const VIEWPAY_CHECKOUT_GUARD_REDIRECT_ENABLED = false;

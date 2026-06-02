export const CART_SESSION_COOKIE = "calllink_cart_sid";

/** @deprecated 게스트 쿠키는 GUEST_CART_SESSION_MAX_AGE 사용 */
export const CART_SESSION_MAX_AGE = 60 * 60 * 24 * 90;

/** 비회원 장바구니 쿠키·서버 lazy purge 기준 (3시간) */
export const GUEST_CART_SESSION_MAX_AGE = 60 * 60 * 3;

"use client";

const KAKAO_NOTICE_EVENT = "viewpay-kakao-payment-notice-request";
const KAKAO_NOTICE_RESOLVE = "viewpay-kakao-payment-notice-resolve";

let pendingResolve: ((confirmed: boolean) => void) | null = null;

/** Android 카카오톡 IAB 결제 전 안내 — 모달 Host가 마운트되어 있어야 함 */
export function requestKakaoExternalPaymentConfirm(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    pendingResolve = resolve;
    window.dispatchEvent(new CustomEvent(KAKAO_NOTICE_EVENT));
  });
}

export function resolveKakaoExternalPaymentConfirm(confirmed: boolean): void {
  pendingResolve?.(confirmed);
  pendingResolve = null;
}

export function subscribeKakaoExternalPaymentConfirm(
  onRequest: () => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onRequest();
  window.addEventListener(KAKAO_NOTICE_EVENT, handler);
  return () => window.removeEventListener(KAKAO_NOTICE_EVENT, handler);
}

export { KAKAO_NOTICE_RESOLVE };

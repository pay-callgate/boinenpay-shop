/**
 * 카카오톡 인앱 브라우저 감지.
 * ViewPay 등 PG 결제는 카카오 IAB 안에서 동일 세션으로 진행 (태권월드 방식).
 */

/** 카카오톡 앱 내장 브라우저 User-Agent (iOS/Android 공통 패턴) */
export function isKakaoTalkInAppBrowser(userAgent: string): boolean {
  return /KAKAOTALK/i.test(userAgent);
}

export function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

export function isIOSUserAgent(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

/** ViewPay 결제창 등 PG URL로 이동 — 카카오 IAB 포함 동일 WebView 유지 */
export function assignLocationHrefForPayment(targetUrl: string): void {
  if (typeof window === "undefined") return;
  window.location.href = targetUrl;
}

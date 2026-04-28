/**
 * 카카오톡 인앱 브라우저 감지 및 Android intent URL 생성.
 * Google OAuth 등은 WebView User-Agent에서 disallowed_useragent 로 차단될 수 있어
 * 기본 브라우저 이탈에 사용합니다.
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

/**
 * Android: Chrome 패키지로 현재 https URL을 여는 intent URL.
 * Chrome 미설치 등 시 S.browser_fallback_url로 원본 URL 복귀.
 */
export function buildAndroidChromeIntentUrl(href: string): string {
  try {
    const u = new URL(href);
    const pathPart = `${u.host}${u.pathname}${u.search}${u.hash}`;
    const fallback = encodeURIComponent(href);
    return `intent://${pathPart}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  } catch {
    const stripped = href.replace(/^https?:\/\//i, "");
    return `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end`;
  }
}

/**
 * ViewPay 결제창 등 외부 PG URL로 이동.
 * 카카오톡 인앱(Android)에서는 팝업 충돌 완화를 위해 Chrome intent로 동일 URL을 연다.
 * (주문서 마운트 시 이탈이 아니라, 이 함수 호출 직전 타이밍에만 적용.)
 */
export function assignLocationHrefForPayment(targetUrl: string): void {
  if (typeof window === "undefined") return;
  const ua = navigator.userAgent;
  if (isKakaoTalkInAppBrowser(ua) && isAndroidUserAgent(ua)) {
    window.location.replace(buildAndroidChromeIntentUrl(targetUrl));
    return;
  }
  window.location.href = targetUrl;
}

/**
 * 배포 안전 base URL (거래처 쇼핑몰·어드민 링크·070 연동 등)
 * - 브라우저: window.location.origin 사용 (실서버/데모 도메인 자동 인식)
 * - 서버/SSR: NEXT_PUBLIC_APP_URL 또는 VERCEL_URL (하드코딩 localhost 제거)
 */

function getBaseUrlFallback(): string {
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (app) return app;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "";
}

/**
 * 현재 도메인 베이스 (끝 / 제거).
 * - 브라우저: window.location.origin → 실서버/데모 접속 도메인 자동 반영
 * - 서버: NEXT_PUBLIC_APP_URL 또는 VERCEL_URL (프로덕션/데모 배포 시 env 설정 권장)
 */
export function getBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return getBaseUrlFallback();
}

/**
 * 거래처 전용 쇼핑몰 URL 생성 (복사·070 서비스 URL·리다이렉트 등)
 * @param subdomain 파트너 subdomain (로그인 세션/API에서 조회한 값 사용)
 * @param clientSlug 거래처 slug (없으면 파트너 메인)
 */
export function getStorefrontUrl(
  subdomain: string,
  clientSlug?: string | null
): string {
  const base = getBaseUrl();
  const path = clientSlug ? `${subdomain}/${clientSlug}` : subdomain;
  return base ? `${base}/${path}` : `/${path}`;
}

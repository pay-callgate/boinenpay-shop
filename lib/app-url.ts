/**
 * 배포 안전 base URL (거래처 쇼핑몰·어드민 링크·070 연동 등)
 * - window 미사용 → SSR/클라이언트 동일 값으로 hydration 오류 방지
 * - NEXT_PUBLIC_APP_URL / VERCEL_URL / localhost 순으로 fallback
 */

function getBaseUrlFallback(): string {
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (app) return app;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** 클라이언트·서버 공통 사용. 빌드/런타임 env 기준으로 origin 반환 (끝 / 제거) */
export function getBaseUrl(): string {
  return getBaseUrlFallback();
}

/**
 * 거래처 전용 쇼핑몰 URL 생성 (복사·070 서비스 URL·리다이렉트 등)
 * @param subdomain 파트너 subdomain
 * @param clientSlug 거래처 slug (없으면 파트너 메인)
 */
export function getStorefrontUrl(
  subdomain: string,
  clientSlug?: string | null
): string {
  const base = getBaseUrlFallback();
  const path = clientSlug ? `${subdomain}/${clientSlug}` : subdomain;
  return `${base}/${path}`;
}

/**
 * 거래처 쇼핑몰 로그인 callbackUrl 공통 처리.
 * - 상대 경로(pathname + search)로 컨텍스트 유지
 * - …/login 자기참조 루프 방지
 * - 루트 /login 진입 시 서브도메인 추론(호스트 shopping.com 서브도메인, referrer)
 */

const RESERVED_FIRST_SEG = new Set([
  "admin",
  "api",
  "_next",
  "login",
  "favicon.ico",
]);

/**
 * callbackUrl이 파트너 중앙 어드민(/admin...) 복귀용인지.
 * NextAuth가 /login?error=...&callbackUrl=/admin 으로 보낼 때 몰 로그인으로 잘못 라우팅되지 않게 함.
 */
export function isAdminPortalCallbackUrl(raw: string): boolean {
  if (!raw?.trim()) return false;
  try {
    const pathnameOnly = raw.startsWith("http")
      ? new URL(raw).pathname
      : raw.split("?")[0] ?? "";
    const first = pathnameOnly.split("/").filter(Boolean)[0];
    return first === "admin";
  } catch {
    return false;
  }
}

/** 브라우저 기준 현재 쇼핑 풀 경로 (도메인 제외, 쿼리 포함) */
export function getShopRelativeReturnPath(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

/** pathname + search 조립 (SSR/훅에서 pathname·searchParams 전달 시) */
export function buildShopRelativeReturnPath(
  pathname: string,
  search: string
): string {
  const q =
    search && !search.startsWith("?")
      ? `?${search}`
      : search;
  return `${pathname}${q}`;
}

/**
 * callbackUrl이 로그인 페이지를 가리키면 상위 경로(몰·거래처 홈)로 치환.
 * @returns 빈 문자열: 순수 `/login` 등으로 몰을 알 수 없을 때(호출처에서 fallback)
 */
export function sanitizeCallbackUrlAgainstLoginLoop(
  callbackUrl: string
): string {
  if (!callbackUrl?.trim()) return callbackUrl;
  try {
    const u = callbackUrl.startsWith("http")
      ? new URL(callbackUrl)
      : new URL(callbackUrl, "http://relative.local");
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs.length === 0) return callbackUrl;
    if (segs[segs.length - 1] !== "login") return callbackUrl;
    const base = segs.slice(0, -1);
    if (base.length === 0) return "";
    return "/" + base.join("/") + (u.search || "");
  } catch {
    return callbackUrl;
  }
}

function subdomainFromHostname(hostname: string): string | null {
  const domain = "shopping.com";
  if (
    !hostname.endsWith(domain) ||
    hostname === domain ||
    hostname === `www.${domain}`
  ) {
    return null;
  }
  const sub = hostname.slice(0, -(domain.length + 1));
  if (sub.includes(".")) return null;
  return sub || null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    const row = document.cookie
      .split("; ")
      .find((r) => r.startsWith(`${name}=`));
    if (!row) return null;
    const v = row.slice(name.length + 1).trim();
    return v ? decodeURIComponent(v) : null;
  } catch {
    return null;
  }
}

/**
 * /login (루트) 단독 등 callbackUrl이 없을 때 파트너 subdomain 추론.
 * 호스트(shopping.com 서브도메인), referrer 첫 경로, 쿠키 `last_partner_subdomain`(선택).
 */
export function inferPartnerSubdomainForRootLogin(defaultSub: string): string {
  if (typeof window === "undefined") return defaultSub;

  const fromCookie = readCookie("last_partner_subdomain");
  if (fromCookie && !RESERVED_FIRST_SEG.has(fromCookie)) return fromCookie;

  const hostSub = subdomainFromHostname(window.location.hostname);
  if (hostSub && !RESERVED_FIRST_SEG.has(hostSub)) return hostSub;

  try {
    const ref = document.referrer;
    if (ref) {
      const seg = new URL(ref).pathname.split("/").filter(Boolean)[0];
      if (seg && !RESERVED_FIRST_SEG.has(seg)) return seg;
    }
  } catch {
    /* ignore */
  }

  return defaultSub;
}

/** ShopLayout이 심는 마지막 거래처 slug (로그인·추가정보 후 복귀 URL 보정용) */
export const LAST_SHOP_CLIENT_SLUG_COOKIE = "last_shop_client_slug";

export function readLastShopClientSlugFromBrowser(): string | null {
  return readCookie(LAST_SHOP_CLIENT_SLUG_COOKIE);
}

/**
 * /{subdomain}/mypage 처럼 거래처 slug 없이 mypage만 온 잘못된 경로를 보정합니다.
 * @param pathOrUrl 상대 또는 절대 URL
 * @param clientSlugHint 쿠키 등에서 복원한 거래처 slug (없으면 파트너 루트만 사용)
 */
export function normalizeShopReturnUrl(
  pathOrUrl: string,
  subdomain: string,
  clientSlugHint: string | null
): string {
  if (!pathOrUrl?.trim()) return pathOrUrl;
  try {
    const isAbs = pathOrUrl.startsWith("http");
    const u = isAbs
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl, "http://relative.local");
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs[0] !== subdomain) return pathOrUrl;
    if (segs.length === 2 && segs[1] === "mypage") {
      if (clientSlugHint && !RESERVED_FIRST_SEG.has(clientSlugHint)) {
        u.pathname = `/${subdomain}/${clientSlugHint}/mypage`;
      } else {
        u.pathname = `/${subdomain}`;
      }
      if (isAbs) return `${u.origin}${u.pathname}${u.search}`;
      return u.pathname + (u.search || "");
    }
    return pathOrUrl;
  } catch {
    return pathOrUrl;
  }
}

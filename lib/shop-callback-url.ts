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

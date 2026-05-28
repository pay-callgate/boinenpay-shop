/**
 * 거래처 전용 쇼핑몰 clientSlug 복원 — 로그인·홈 링크·마스터 템플릿 차단에 공통 사용.
 */

import {
  LAST_SHOP_CLIENT_SLUG_COOKIE,
  readLastShopClientSlugFromBrowser,
} from "@/lib/shop-callback-url";
import {
  CLIENT_SOURCE_SLUG_COOKIE,
  getClientSourceCookie,
} from "@/lib/user-client";

/** 파트너 어드민 전용 마스터 템플릿 미리보기 경로 (고객 노출 금지) */
export const SHOP_MASTER_PREVIEW_SLUG = "_preview";

const RESERVED_FIRST_SEG = new Set([
  "admin",
  "api",
  "_next",
  "login",
  "signup",
  "favicon.ico",
  SHOP_MASTER_PREVIEW_SLUG,
]);

export function isReservedShopPathSegment(seg: string): boolean {
  const s = seg.trim();
  return !s || RESERVED_FIRST_SEG.has(s);
}

/** 경로·URL에서 `/{subdomain}/{clientSlug}` 의 slug 추출 */
export function getClientSlugFromShopPath(
  pathOrUrl: string,
  subdomain: string
): string | null {
  if (!pathOrUrl?.trim() || !subdomain?.trim()) return null;
  try {
    const pathname = pathOrUrl.startsWith("http")
      ? new URL(pathOrUrl).pathname
      : pathOrUrl.split("?")[0] ?? pathOrUrl;
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== subdomain || parts.length < 2) return null;
    const slug = parts[1]!;
    if (isReservedShopPathSegment(slug)) return null;
    return slug;
  } catch {
    return null;
  }
}

/** @deprecated use getClientSlugFromShopPath */
export function getClientSlugFromCallbackUrl(url: string): string | null {
  const parts = (() => {
    try {
      const pathname = url.startsWith("http") ? new URL(url).pathname : url;
      return pathname.split("/").filter(Boolean);
    } catch {
      return [];
    }
  })();
  if (parts.length < 2) return null;
  const slug = parts[1]!;
  if (isReservedShopPathSegment(slug)) return null;
  return slug;
}

export type ResolveShopClientSlugInput = {
  subdomain: string;
  callbackUrl?: string | null;
  /** ?clientSlug= / ?client= */
  queryClientSlug?: string | null;
};

/**
 * 브라우저에서 거래처 slug 복원 (우선순위).
 * 1. callbackUrl / 현재 경로
 * 2. 쿼리 clientSlug
 * 3. last_shop_client_slug 쿠키
 * 4. client_source_slug 쿠키
 */
export function resolveShopClientSlug(input: ResolveShopClientSlugInput): string | null {
  const subdomain = input.subdomain?.trim();
  if (!subdomain) return null;

  const cb = input.callbackUrl?.trim();
  if (cb) {
    const fromCb = getClientSlugFromShopPath(cb, subdomain);
    if (fromCb) return fromCb;
  }

  const fromQuery = input.queryClientSlug?.trim();
  if (fromQuery && !isReservedShopPathSegment(fromQuery)) {
    return fromQuery;
  }

  const fromLast = readLastShopClientSlugFromBrowser();
  if (fromLast && !isReservedShopPathSegment(fromLast)) {
    return fromLast;
  }

  const { clientSlug: fromSource } = getClientSourceCookie();
  if (fromSource && !isReservedShopPathSegment(fromSource)) {
    return fromSource;
  }

  return null;
}

/** 고객에게 노출하면 안 되는 마스터 템플릿 URL 여부 */
export function isCustomerForbiddenMasterTemplatePath(
  pathname: string,
  subdomain: string
): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const parts = normalized.split("/").filter(Boolean);
  if (parts[0] !== subdomain) return false;
  if (parts.length === 1) return true;
  if (parts.length === 2 && parts[1] === SHOP_MASTER_PREVIEW_SLUG) return true;
  return false;
}

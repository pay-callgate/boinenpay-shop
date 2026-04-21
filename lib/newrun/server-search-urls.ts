import { getBaseUrl } from "@/lib/app-url";
import {
  buildMemberSearchUrl,
  buildOptionSearchUrl,
  buildProductSearchUrl,
} from "@/lib/newrun/association-search-urls";
import type { NewrunCallbackKind } from "@/lib/newrun/constants";
import { NEWRUN_CALLBACK_PATHS } from "@/lib/newrun/constants";
import { buildRoseSession } from "@/lib/newrun/rose-session";

/**
 * 서버에서만 사용: env의 협회 URL·인트라넷 ID로 검색용 절대 URL 생성.
 * - `getBaseUrl()` 서버 분기: `NEXT_PUBLIC_APP_URL` / `VERCEL_URL` (자세한 건 `lib/app-url.ts`)
 * - `var_ret`는 반드시 절대 URL이어야 하므로 base가 비면 에러.
 */
export function getNewrunAssocBaseUrlFromEnv(): string {
  const raw = process.env.NEWRUN_ASSOC_BASE_URL?.trim();
  if (!raw) {
    throw new Error("NEWRUN_ASSOC_BASE_URL is not set");
  }
  return raw.replace(/\/$/, "");
}

export function getNewrunIntranetIdFromEnv(): string {
  const id = process.env.NEWRUN_ASSOC_INTRANET_ID?.trim();
  if (!id) {
    throw new Error("NEWRUN_ASSOC_INTRANET_ID is not set");
  }
  return id;
}

export function buildNewrunVarRetUrl(
  appBaseUrl: string,
  kind: NewrunCallbackKind
): string {
  const base = appBaseUrl.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error("appBaseUrl is empty: set NEXT_PUBLIC_APP_URL for server-side var_ret");
  }
  const path = NEWRUN_CALLBACK_PATHS[kind];
  return `${base}${path}`;
}

export function buildFloristSearchUrlForServer(
  appBaseUrl: string,
  options?: { nowSec?: number }
): string {
  const assoc = getNewrunAssocBaseUrlFromEnv();
  const intranetId = getNewrunIntranetIdFromEnv();
  const roseSession = buildRoseSession(intranetId, { nowSec: options?.nowSec });
  const varRet = buildNewrunVarRetUrl(appBaseUrl, "florist");
  return buildMemberSearchUrl({ assocBaseUrl: assoc, roseSession, varRetUrl: varRet });
}

export function buildProductSearchUrlForServer(
  appBaseUrl: string,
  options?: { nowSec?: number }
): string {
  const assoc = getNewrunAssocBaseUrlFromEnv();
  const intranetId = getNewrunIntranetIdFromEnv();
  const roseSession = buildRoseSession(intranetId, { nowSec: options?.nowSec });
  const varRet = buildNewrunVarRetUrl(appBaseUrl, "product");
  return buildProductSearchUrl({ assocBaseUrl: assoc, roseSession, varRetUrl: varRet });
}

export function buildOptionSearchUrlForServer(
  appBaseUrl: string,
  options?: { nowSec?: number }
): string {
  const assoc = getNewrunAssocBaseUrlFromEnv();
  const intranetId = getNewrunIntranetIdFromEnv();
  const roseSession = buildRoseSession(intranetId, { nowSec: options?.nowSec });
  const varRet = buildNewrunVarRetUrl(appBaseUrl, "option");
  return buildOptionSearchUrl({ assocBaseUrl: assoc, roseSession, varRetUrl: varRet });
}

/**
 * Request 기반이 아닐 때: `getBaseUrl()`만으로 app origin 결정 (API Route·Server Action에서 호출).
 */
export function buildFloristSearchUrlUsingAppConfig(options?: {
  nowSec?: number;
}): string {
  const base = getBaseUrl();
  return buildFloristSearchUrlForServer(base, options);
}

export function buildProductSearchUrlUsingAppConfig(options?: {
  nowSec?: number;
}): string {
  const base = getBaseUrl();
  return buildProductSearchUrlForServer(base, options);
}

export function buildOptionSearchUrlUsingAppConfig(options?: {
  nowSec?: number;
}): string {
  const base = getBaseUrl();
  return buildOptionSearchUrlForServer(base, options);
}

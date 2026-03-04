"use client";

import { signOut } from "next-auth/react";
import { toast } from "@/components/shop/ToastContext";

const SESSION_EXPIRED_MESSAGE =
  "안전한 이용을 위해 세션이 만료되었습니다. 다시 로그인해 주세요.";

/**
 * 401/403 수신 시 공통 처리: 토스트 알림 → 로그아웃 → 로그인 페이지 리다이렉트
 * (거래처 쇼핑몰 전역 세션 만료 정책)
 * signOut 후에도 리다이렉트가 누락되지 않도록 window.location.replace로 이중 보장.
 */
async function handleSessionExpiry(): Promise<never> {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const subdomain = pathname.split("/")[1] ?? "shop";
  const loginUrl = `/${subdomain}/login?callbackUrl=${encodeURIComponent(pathname)}`;
  toast(SESSION_EXPIRED_MESSAGE, "error");
  try {
    await signOut({ redirect: false });
  } catch {
    // signOut 실패해도 리다이렉트는 수행
  }
  if (typeof window !== "undefined") {
    window.location.replace(loginUrl);
  }
  throw new Error("SESSION_EXPIRED");
}

export type ShopFetchInit = RequestInit & {
  /** true면 401/403 시 전역 세션 만료 처리 후 throw (기본 true) */
  handleSessionExpiry?: boolean;
};

/**
 * 거래처 쇼핑몰 전용 fetch 래퍼.
 * - credentials: "include" 기본 적용
 * - 401/403 시 전역 세션 만료 처리(알림 → signOut → 로그인 페이지 리다이렉트) 후 throw
 *
 * 사용처: app/[subdomain]/[clientSlug]/ 하위 페이지·컴포넌트의 API 호출
 */
export async function shopFetch(
  input: RequestInfo | URL,
  init?: ShopFetchInit
): Promise<Response> {
  const { handleSessionExpiry: doHandle = true, ...rest } = init ?? {};
  const options: RequestInit = {
    credentials: "include",
    ...rest,
    cache: "no-store", // 캐시 원천 차단 — 항상 최신 응답만 사용
  };
  const res = await fetch(input, options);

  // 401: 세션 만료로 간주해 전역 로그아웃 처리
  // 403: 단순 권한 부족이므로 여기서는 세션 만료로 취급하지 않는다.
  if (doHandle && res.status === 401) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    console.warn("[shopFetch] 세션 만료(401/403) → 로그인 페이지로 이동", { url, status: res.status });
    await handleSessionExpiry();
  }

  return res;
}

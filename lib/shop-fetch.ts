"use client";

import { signOut } from "next-auth/react";

const SESSION_EXPIRED_MESSAGE =
  "안전한 이용을 위해 세션이 만료되었습니다. 다시 로그인해 주세요.";

/**
 * 401/403 수신 시 공통 처리: 알림 → 로그아웃 → 로그인 페이지 리다이렉트
 * (거래처 쇼핑몰 전역 세션 만료 정책)
 */
async function handleSessionExpiry(): Promise<never> {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const subdomain = pathname.split("/")[1] ?? "shop";
  const loginUrl = `/${subdomain}/login?callbackUrl=${encodeURIComponent(pathname)}`;
  alert(SESSION_EXPIRED_MESSAGE);
  await signOut({ redirect: true, callbackUrl: loginUrl });
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
  };
  const res = await fetch(input, options);

  if (doHandle && (res.status === 401 || res.status === 403)) {
    await handleSessionExpiry();
  }

  return res;
}

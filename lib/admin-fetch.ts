"use client";

import { signOut } from "next-auth/react";

const SESSION_EXPIRED_MESSAGE =
  "세션이 만료되었습니다. 안전한 이용을 위해 다시 로그인해 주세요.";

/**
 * 어드민 전용 fetch 래퍼.
 * 401(Unauthorized) 시 즉시 세션 만료 알림 후 로그인 페이지로 리다이렉트.
 * "등록된 상품이 없습니다" 등 빈 화면 대신 명시적 로그아웃 처리.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (res.status === 401) {
    alert(SESSION_EXPIRED_MESSAGE);
    await signOut({ redirect: true, callbackUrl: "/admin/login?callbackUrl=/admin" });
    throw new Error("SESSION_EXPIRED");
  }

  return res;
}

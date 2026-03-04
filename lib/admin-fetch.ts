"use client";

import { signOut } from "next-auth/react";

const SESSION_EXPIRED_MESSAGE =
  "세션이 만료되었습니다. 안전한 이용을 위해 다시 로그인해 주세요.";

const ADMIN_LOGIN_URL = "/admin/login?callbackUrl=/admin";

/**
 * 어드민 전용 fetch 래퍼.
 * 401(Unauthorized) 시 즉시 세션 만료 알림 후 로그인 페이지로 반드시 리다이렉트.
 * signOut 실패/지연과 관계없이 window.location.replace로 이동 보장.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: "include",
    cache: "no-store", // 캐시 원천 차단 — 0.1초도 과거 응답 허용 안 함
  });

  if (res.status === 401) {
    alert(SESSION_EXPIRED_MESSAGE);
    try {
      await signOut({ redirect: false });
    } catch {
      // signOut 실패해도 리다이렉트는 수행
    }
    if (typeof window !== "undefined") {
      window.location.replace(ADMIN_LOGIN_URL);
    }
    throw new Error("SESSION_EXPIRED");
  }

  return res;
}

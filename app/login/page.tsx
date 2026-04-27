"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import {
  inferPartnerSubdomainForRootLogin,
  isAdminPortalCallbackUrl,
  sanitizeCallbackUrlAgainstLoginLoop,
} from "@/lib/shop-callback-url";

/** callbackUrl·추론 실패 시 최후 폴백 (레거시 데모 파트너) */
const DEFAULT_SUBDOMAIN = "wooribugo";

const RESERVED_SUBDOMAIN_HINT = new Set(["login", "admin", "api", "_next"]);

function subdomainFromCallbackPath(rawCallback: string): string | null {
  try {
    const pathnameOnly = rawCallback.startsWith("http")
      ? new URL(rawCallback).pathname
      : rawCallback.split("?")[0] ?? "";
    const first = pathnameOnly.split("/").filter(Boolean)[0];
    if (first && !RESERVED_SUBDOMAIN_HINT.has(first)) return first;
  } catch {
    /* ignore */
  }
  return null;
}

function LoginRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const rawCallback = searchParams?.get("callbackUrl") ?? "";
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    const adminByReferrer =
      typeof document !== "undefined" &&
      (() => {
        try {
          const ref = document.referrer;
          if (!ref) return false;
          return new URL(ref).pathname.startsWith("/admin");
        } catch {
          return false;
        }
      })();

    if (isAdminPortalCallbackUrl(rawCallback) || adminByReferrer) {
      const query = params.toString() ? `?${params.toString()}` : "";
      router.replace(`/admin/login${query}`);
      return;
    }

    let subdomain = DEFAULT_SUBDOMAIN;
    if (rawCallback) {
      const fromPath = subdomainFromCallbackPath(rawCallback);
      subdomain = fromPath ?? inferPartnerSubdomainForRootLogin(DEFAULT_SUBDOMAIN);
    } else {
      subdomain = inferPartnerSubdomainForRootLogin(DEFAULT_SUBDOMAIN);
    }

    if (rawCallback) {
      let safe = sanitizeCallbackUrlAgainstLoginLoop(rawCallback);
      if (safe === "") {
        safe = `/${subdomain}`;
      }
      if (safe !== rawCallback) {
        params.set("callbackUrl", safe);
      }
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    router.replace(`/${subdomain}/login${query}`);
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-50 to-white">
      <div className="text-center">
        <p className="text-slate-600">{/* 로그인 페이지로 이동 중... */}</p>
        <div className="mt-4 h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600 mx-auto" />
      </div>
    </div>
  );
}

/**
 * NextAuth 에러/로그인 리다이렉트용 루트 로그인 페이지.
 * - OAuthCallback 등 에러 시 NextAuth가 /login?error=...&callbackUrl=... 로 보냄.
 * - callbackUrl이 로그인 자기참조면 몰 홈으로 치환 후 /{subdomain}/login 로 리다이렉트.
 * - callbackUrl이 없으면 호스트·referrer·last_partner_subdomain 쿠키로 subdomain 추론.
 * - useSearchParams는 Suspense 경계 필요.
 */
export default function LoginRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-50 to-white">
          <div className="text-center">
            <p className="text-slate-600"></p>
            <div className="mt-4 h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600 mx-auto" />
          </div>
        </div>
      }
    >
      <LoginRedirectContent />
    </Suspense>
  );
}

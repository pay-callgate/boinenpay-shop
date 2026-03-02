"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

const DEFAULT_SUBDOMAIN = "testpartner";

function LoginRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const callbackUrl = searchParams?.get("callbackUrl") ?? "";
    let subdomain = DEFAULT_SUBDOMAIN;

    if (callbackUrl) {
      try {
        const pathname = callbackUrl.startsWith("http")
          ? new URL(callbackUrl).pathname
          : callbackUrl;
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length >= 1) subdomain = parts[0];
      } catch {
        // keep default
      }
    }

    const query = searchParams?.toString() ? `?${searchParams.toString()}` : "";
    router.replace(`/${subdomain}/login${query}`);
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-50 to-white">
      <div className="text-center">
        <p className="text-slate-600">로그인 페이지로 이동 중...</p>
        <div className="mt-4 h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600 mx-auto" />
      </div>
    </div>
  );
}

/**
 * NextAuth 에러/로그인 리다이렉트용 루트 로그인 페이지.
 * - OAuthCallback 등 에러 시 NextAuth가 /login?error=...&callbackUrl=... 로 보냄.
 * - callbackUrl에서 subdomain을 추출해 /{subdomain}/login 로 리다이렉트.
 * - useSearchParams는 Suspense 경계 필요.
 */
export default function LoginRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-50 to-white">
          <div className="text-center">
            <p className="text-slate-600">로딩 중...</p>
            <div className="mt-4 h-8 w-8 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600 mx-auto" />
          </div>
        </div>
      }
    >
      <LoginRedirectContent />
    </Suspense>
  );
}

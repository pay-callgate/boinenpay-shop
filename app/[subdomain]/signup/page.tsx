"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/**
 * @deprecated 통합 인증 허브로 통폐합됨. /{subdomain}/login 으로 리다이렉트.
 */
function SignupToLoginRedirectInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subdomain = (params?.subdomain as string) ?? "";

  useEffect(() => {
    const qs = searchParams?.toString() ?? "";
    router.replace(`/${subdomain}/login${qs ? `?${qs}` : ""}`);
  }, [subdomain, router, searchParams]);

  return (
    <div className="flex min-h-[40dvh] items-center justify-center bg-white px-4">
      <p className="text-center text-sm text-slate-500">로그인 화면으로 이동 중…</p>
    </div>
  );
}

export default function ShopSignupRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40dvh] items-center justify-center bg-white">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700"
            aria-hidden
          />
        </div>
      }
    >
      <SignupToLoginRedirectInner />
    </Suspense>
  );
}

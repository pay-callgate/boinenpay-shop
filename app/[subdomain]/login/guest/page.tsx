"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/**
 * @deprecated 통합 인증 허브로 통폐합됨. /{subdomain}/login?tab=guest 로 리다이렉트.
 */
function GuestToLoginRedirectInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subdomain = (params?.subdomain as string) ?? "";

  useEffect(() => {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    p.set("tab", "guest");
    router.replace(`/${subdomain}/login?${p.toString()}`);
  }, [subdomain, router, searchParams]);

  return (
    <div className="flex min-h-[40dvh] items-center justify-center bg-white px-4">
      <p className="text-center text-sm text-slate-500">로그인 화면으로 이동 중…</p>
    </div>
  );
}

export default function GuestOrderLoginRedirectPage() {
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
      <GuestToLoginRedirectInner />
    </Suspense>
  );
}

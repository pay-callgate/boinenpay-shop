"use client";

import { signIn } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { getStorefrontUrl } from "@/lib/app-url";
import { sanitizeCallbackUrlAgainstLoginLoop } from "@/lib/shop-callback-url";

/**
 * 거래처 쇼핑몰 고객(Client User) 전용 로그인 페이지.
 * - 쇼핑몰과 동일한 라벤더/핑크 감성 UI
 * - callbackUrl에서 거래처 Slug 추출 → 해당 거래처명·로고 표시 (소속감)
 * - SNS 로그인 후 callbackUrl로 리다이렉트
 */

interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

export default function CustomerLoginPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subdomain = (params?.subdomain as string) ?? "";
  const callbackUrl = useMemo(() => {
    const raw = searchParams?.get("callbackUrl");
    const fallback = getStorefrontUrl(subdomain);
    if (raw == null || raw === "") return fallback;
    const safe = sanitizeCallbackUrlAgainstLoginLoop(raw);
    if (safe === "") return fallback;
    return safe;
  }, [searchParams, subdomain]);

  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [contextLoading, setContextLoading] = useState(true);

  // callbackUrl에서 거래처 Slug 추출 (예: /wooribugo/knauto/products/xxx → knauto)
  const getClientSlugFromCallbackUrl = (url: string): string | null => {
    try {
      const pathname = url.startsWith("http") ? new URL(url).pathname : url;
      const parts = pathname.split("/").filter(Boolean);
      // [subdomain, clientSlug, ...]
      if (parts.length >= 2) return parts[1];
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!subdomain) {
      setContextLoading(false);
      return;
    }
    const clientSlug = getClientSlugFromCallbackUrl(callbackUrl);
    if (!clientSlug) {
      setClientInfo(null);
      setContextLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/shop/context?subdomain=${subdomain}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const clients: Array<{ id: string; name: string; slug: string; logo_url: string | null }> = data?.clients ?? [];
        const client = clients.find((c: { slug: string }) => c.slug === clientSlug) ?? null;
        if (!cancelled) setClientInfo(client || null);
      } catch {
        if (!cancelled) setClientInfo(null);
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subdomain, callbackUrl]);

  useEffect(() => {
    console.log("[StorefrontLogin] mount", {
      subdomain,
      callbackUrl,
      hasCallbackUrlParam: searchParams?.get("callbackUrl") != null,
      error: searchParams?.get("error") ?? null,
    });
  }, [subdomain, callbackUrl, searchParams]);

  const handleSignIn = (provider: "google" | "kakao" | "naver") => {
    console.log("[StorefrontLogin] handleSignIn called", { provider, callbackUrl });
    signIn(provider, { callbackUrl })
      .then((res) => {
        console.log("[StorefrontLogin] signIn result", res);
      })
      .catch((err) => {
        console.error("[StorefrontLogin] signIn error", err);
      });
  };

  const headerTitle = clientInfo
    ? `${clientInfo.name} 전용 쇼핑몰`
    : `${subdomain} 쇼핑몰 로그인`;
  const headerSubtitle = clientInfo
    ? "임직원 여러분 환영합니다."
    : "쇼핑몰 로그인";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-purple-50 to-white p-6"
      style={{ minHeight: "100dvh" }}
    >
      <div className="w-full max-w-sm rounded-xl overflow-hidden shadow-lg">
        {/* 상단 헤더 영역: 연한 라벤더 배경, 로고·타이틀·서브텍스트 */}
        <div className="rounded-t-xl bg-purple-50 py-10 px-6 text-center border-b border-purple-100">
          {contextLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-purple-100 animate-pulse" />
              <div className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
              <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
            </div>
          ) : clientInfo ? (
            <>
              <div className="mb-3 flex justify-center">
                {clientInfo.logo_url ? (
                  <img
                    src={clientInfo.logo_url}
                    alt={clientInfo.name}
                    className="h-14 w-14 rounded-xl object-contain bg-white border border-slate-100"
                  />
                ) : (
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100 text-purple-700 text-lg font-bold"
                    aria-hidden
                  >
                    {clientInfo.name.charAt(0)}
                  </div>
                )}
              </div>
              <h1 className="text-slate-900 text-xl font-bold tracking-tight">
                {headerTitle}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {headerSubtitle}
              </p>
            </>
          ) : (
            <>
              <div className="mb-3 flex justify-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100 text-purple-600"
                  aria-hidden
                >
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>
              </div>
              <h1 className="text-slate-900 text-xl font-bold tracking-tight">
                CallLink Shopping
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {headerSubtitle}
              </p>
            </>
          )}
        </div>

        {/* 하단 컨텐츠 영역: 흰색 배경, 안내 문구·소셜 로그인 버튼 */}
        <div className="rounded-b-xl bg-white p-8">
          {searchParams?.get("error") && (
            <p className="text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2.5 px-3 mb-4">
              이전 로그인 세션이 만료되었거나 오류가 발생했습니다. 아래에서 다시 로그인해 주세요.
            </p>
          )}
          <p className="text-center text-sm text-slate-500 mb-5">
            {clientInfo ? `${clientInfo.name} 임직원 로그인` : `${subdomain} 쇼핑몰`}
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleSignIn("google")}
              className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 active:opacity-90 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              구글 계정으로 로그인
            </button>
            <button
              type="button"
              onClick={() => handleSignIn("kakao")}
              className="flex items-center justify-center gap-3 rounded-lg bg-[#FEE500] px-4 py-3 text-sm font-medium text-[#191919] hover:bg-[#FDD835] active:opacity-90 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path
                  fill="#3C1E1E"
                  d="M24 4C12.95 4 4 11.16 4 20c0 5.6 3.6 10.52 9.04 13.36-.4 1.48-1.44 5.36-1.64 6.2-.24 1.04.4 1.04.84.76.36-.24 5.6-3.8 7.88-5.32 1.28.16 2.6.24 3.92.24 11.04 0 20-7.16 20-16S35.04 4 24 4z"
                />
              </svg>
              카카오톡 계정으로 로그인
            </button>
            <button
              type="button"
              onClick={() => handleSignIn("naver")}
              className="flex items-center justify-center gap-3 rounded-lg bg-[#03C75A] px-4 py-3 text-sm font-medium text-white hover:bg-[#02b350] active:opacity-90 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <rect width="48" height="48" rx="6" fill="#03C75A" />
                <path
                  fill="#fff"
                  d="M16 14h5.2l5.6 9.6V14H32v20h-5.2l-5.6-9.6V34H16V14z"
                />
              </svg>
              네이버 계정으로 로그인
            </button>
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            로그인 후 쇼핑몰 주문을 이용할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

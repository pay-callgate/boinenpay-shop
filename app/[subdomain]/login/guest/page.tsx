"use client";

import { signIn } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { getStorefrontUrl } from "@/lib/app-url";
import { sanitizeCallbackUrlAgainstLoginLoop } from "@/lib/shop-callback-url";
import { useShopLoginContext } from "../_hooks/use-shop-login-context";
import { GuestOrderLookupForm } from "../_components/guest-order-lookup-form";
import { LoginOrDivider } from "../_components/login-or-divider";
import { LoginTabBar } from "../_components/login-tab-bar";
import { ShopLoginChrome } from "../_components/shop-login-chrome";
import { ShopLoginHeader } from "../_components/shop-login-header";
import { SocialLoginButtons } from "../_components/social-login-buttons";

/**
 * 비회원 주문 조회 전용 화면
 * /{subdomain}/login/guest?callbackUrl=...
 */
export default function GuestOrderLoginPage() {
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

  const searchQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set("callbackUrl", callbackUrl);
    return p.toString();
  }, [callbackUrl]);

  const { partnerCompanyName, clientInfo, loading: contextLoading, clientSlugForGuest } =
    useShopLoginContext(subdomain, callbackUrl);

  const partnerLine =
    (partnerCompanyName?.trim() || clientInfo?.name?.trim() || subdomain || "쇼핑몰") + " 임직원 로그인";

  const [guestName, setGuestName] = useState("");
  const [guestOrderNo, setGuestOrderNo] = useState("");
  const [guestPw, setGuestPw] = useState("");
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  const handleOAuth = (provider: "kakao" | "naver") => {
    signIn(provider, { callbackUrl });
  };

  const handleGuestLookup = async (e: FormEvent) => {
    e.preventDefault();
    setGuestError(null);
    if (!clientSlugForGuest) {
      setGuestError("거래처 쇼핑몰 URL로 접속한 뒤 다시 시도해 주세요. (주소에 거래처 코드가 포함되어야 합니다)");
      return;
    }
    setGuestSubmitting(true);
    try {
      const res = await fetch("/api/shop/guest-order-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdomain,
          clientSlug: clientSlugForGuest,
          ordererName: guestName.trim(),
          orderNo: guestOrderNo.trim(),
          guestPassword: guestPw,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        setGuestError(json.error?.message ?? "조회에 실패했습니다.");
        return;
      }
      const { orderId, guestToken, sig, clientSlug } = json.data;
      const dest = `/${subdomain}/${clientSlug}/mypage/orders/${orderId}?guestToken=${encodeURIComponent(guestToken)}&sig=${encodeURIComponent(sig)}`;
      window.location.href = dest;
    } catch {
      setGuestError("요청 중 오류가 발생했습니다.");
    } finally {
      setGuestSubmitting(false);
    }
  };

  return (
    <ShopLoginChrome subdomain={subdomain} callbackUrl={callbackUrl}>
      <div className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-xl shadow-slate-300/30">
        <ShopLoginHeader
          contextLoading={contextLoading}
          clientInfo={clientInfo}
          partnerCompanyName={partnerCompanyName}
          subdomain={subdomain}
        />

        <div className="bg-white px-6 pb-8 pt-6 sm:px-8">
          {searchParams?.get("error") && (
            <p className="mb-6 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-center text-sm text-amber-900">
              로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.
            </p>
          )}

          {contextLoading ? (
            <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <>
              <SocialLoginButtons
                caption={partnerLine}
                onKakao={() => handleOAuth("kakao")}
                onNaver={() => handleOAuth("naver")}
              />

              <LoginOrDivider />

              <LoginTabBar subdomain={subdomain} searchQuery={searchQuery} active="guest" />

              <GuestOrderLookupForm
                clientSlugForGuest={clientSlugForGuest}
                guestName={guestName}
                guestOrderNo={guestOrderNo}
                guestPw={guestPw}
                guestSubmitting={guestSubmitting}
                guestError={guestError}
                onGuestNameChange={setGuestName}
                onGuestOrderNoChange={setGuestOrderNo}
                onGuestPwChange={setGuestPw}
                onSubmit={handleGuestLookup}
              />
            </>
          )}
        </div>
      </div>
    </ShopLoginChrome>
  );
}

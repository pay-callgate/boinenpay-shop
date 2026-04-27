"use client";

import { signIn } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useRef, type FormEvent } from "react";
import { getStorefrontUrl } from "@/lib/app-url";
import { sanitizeCallbackUrlAgainstLoginLoop } from "@/lib/shop-callback-url";
import { useShopLoginContext } from "./_hooks/use-shop-login-context";
import { buildShopLoginQuery } from "./_lib/shop-login-query";
import { GuestOrderLookupForm } from "./_components/guest-order-lookup-form";
import { LoginEmailStartHint } from "./_components/login-email-start-hint";
import { LoginOrDivider } from "./_components/login-or-divider";
import { LoginTabBar } from "./_components/login-tab-bar";
import type { ShopLoginTab } from "./_components/login-tab-bar-types";
import { MemberLoginForm } from "./_components/member-login-form";
import { ShopLoginChrome } from "./_components/shop-login-chrome";
import { ShopLoginHeader } from "./_components/shop-login-header";
import { SocialLoginButtons } from "./_components/social-login-buttons";

function tabFromSearch(sp: ReturnType<typeof useSearchParams>): ShopLoginTab {
  return sp?.get("tab") === "guest" ? "guest" : "member";
}

/**
 * 통합 인증 허브 — 소셜 + 기존 회원(이메일) + 비회원 주문조회
 * /{subdomain}/login
 */
export default function CustomerLoginPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const subdomain = (params?.subdomain as string) ?? "";
  const tab = useMemo(() => tabFromSearch(searchParams), [searchParams]);

  const callbackUrl = useMemo(() => {
    const raw = searchParams?.get("callbackUrl");
    const fallback = getStorefrontUrl(subdomain);
    if (raw == null || raw === "") return fallback;
    const safe = sanitizeCallbackUrlAgainstLoginLoop(raw);
    if (safe === "") return fallback;
    return safe;
  }, [searchParams, subdomain]);

  const { partnerCompanyName, clientInfo, loading: contextLoading, clientSlugForGuest } =
    useShopLoginContext(subdomain, callbackUrl);

  const partnerLine =
    (partnerCompanyName?.trim() || clientInfo?.name?.trim() || subdomain || "쇼핑몰") +
    " 임직원 로그인";

  const memberIdInputRef = useRef<HTMLInputElement>(null);

  const handleEmailStart = () => {
    if (tab !== "member") {
      const q = buildShopLoginQuery(callbackUrl, "member");
      router.replace(`/${subdomain}/login?${q}`);
    }
    window.setTimeout(() => memberIdInputRef.current?.focus(), 0);
  };

  const handleOAuth = (provider: "kakao" | "naver") => {
    signIn(provider, { callbackUrl });
  };

  const [showPw, setShowPw] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [memberPw, setMemberPw] = useState("");
  const [autoLogin, setAutoLogin] = useState(false);
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const handleMemberLogin = async (e: FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    setMemberSubmitting(true);
    try {
      const email = memberId.trim().toLowerCase();
      if (!email || !memberPw) {
        setMemberError("아이디와 비밀번호를 입력해 주세요.");
        return;
      }
      const res = await signIn("credentials", {
        email,
        password: memberPw,
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        setMemberError("아이디 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      if (res?.url) {
        window.location.href = res.url;
      } else {
        window.location.href = callbackUrl;
      }
    } finally {
      setMemberSubmitting(false);
    }
  };

  const [guestName, setGuestName] = useState("");
  const [guestOrderNo, setGuestOrderNo] = useState("");
  const [guestPw, setGuestPw] = useState("");
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  const handleGuestLookup = async (e: FormEvent) => {
    e.preventDefault();
    setGuestError(null);
    if (!clientSlugForGuest) {
      setGuestError(
        "거래처 쇼핑몰 URL로 접속한 뒤 다시 시도해 주세요. (주소에 거래처 코드가 포함되어야 합니다)"
      );
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

        <div className="bg-white px-6 pb-10 pt-6 sm:px-8 sm:pb-10 sm:pt-7">
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

              <LoginEmailStartHint onEmailStart={handleEmailStart} />

              <div className="mt-6">
                <LoginTabBar subdomain={subdomain} callbackUrl={callbackUrl} active={tab} />
              </div>

              {tab === "member" ? (
                <MemberLoginForm
                  subdomain={subdomain}
                  callbackUrl={callbackUrl}
                  memberIdInputRef={memberIdInputRef}
                  memberId={memberId}
                  memberPw={memberPw}
                  showPw={showPw}
                  autoLogin={autoLogin}
                  memberSubmitting={memberSubmitting}
                  memberError={memberError}
                  onMemberIdChange={setMemberId}
                  onMemberPwChange={setMemberPw}
                  onTogglePw={() => setShowPw((v) => !v)}
                  onAutoLoginChange={setAutoLogin}
                  onSubmit={handleMemberLogin}
                />
              ) : (
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
              )}
            </>
          )}
        </div>
      </div>
    </ShopLoginChrome>
  );
}

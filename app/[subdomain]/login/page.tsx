"use client";

import { signIn } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef, type FormEvent } from "react";
import { getStorefrontUrl } from "@/lib/app-url";
import { resolveShopClientSlug } from "@/lib/resolve-shop-client-slug";
import { sanitizeCallbackUrlAgainstLoginLoop } from "@/lib/shop-callback-url";
import { useShopLoginContext } from "./_hooks/use-shop-login-context";
import { GuestOrderLookupForm } from "./_components/guest-order-lookup-form";
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
  const subdomain = (params?.subdomain as string) ?? "";
  const tab = useMemo(() => tabFromSearch(searchParams), [searchParams]);

  const queryClientSlug =
    searchParams?.get("clientSlug")?.trim() ||
    searchParams?.get("client")?.trim() ||
    null;

  const callbackUrl = useMemo(() => {
    const raw = searchParams?.get("callbackUrl");
    const slugHint = resolveShopClientSlug({
      subdomain,
      callbackUrl: raw,
      queryClientSlug,
    });
    const fallback = getStorefrontUrl(subdomain, slugHint);
    if (raw == null || raw === "") return fallback;
    const safe = sanitizeCallbackUrlAgainstLoginLoop(raw);
    if (safe === "") return fallback;
    return safe;
  }, [searchParams, subdomain, queryClientSlug]);

  const guestOrderNoFromQuery = searchParams?.get("orderNo")?.trim() ?? "";

  const {
    partnerCompanyName,
    clientInfo,
    loading: contextLoading,
    clientSlugForGuest,
    resolvedClientSlug,
  } = useShopLoginContext(subdomain, callbackUrl, queryClientSlug);

  /** 주문완료 → 조회 바로가기: URL의 clientSlug·orderNo를 callbackUrl보다 우선 */
  const guestLookupClientSlug = useMemo(() => {
    if (guestOrderNoFromQuery && queryClientSlug) {
      return queryClientSlug;
    }
    return clientSlugForGuest;
  }, [guestOrderNoFromQuery, queryClientSlug, clientSlugForGuest]);

  const memberIdInputRef = useRef<HTMLInputElement>(null);

  const handleOAuth = (provider: "kakao" | "naver") => {
    signIn(provider, { callbackUrl });
  };

  const [showPw, setShowPw] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [memberPw, setMemberPw] = useState("");
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

  const guestNameSeed = searchParams?.get("ordererName")?.trim() ?? "";
  const guestOrderNoSeed = searchParams?.get("orderNo")?.trim() ?? "";
  const [guestName, setGuestName] = useState(guestNameSeed);
  const [guestOrderNo, setGuestOrderNo] = useState(guestOrderNoSeed);
  const [guestPw, setGuestPw] = useState("");
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  useEffect(() => {
    if (guestNameSeed && !guestName.trim()) {
      setGuestName(guestNameSeed);
    }
    if (guestOrderNoSeed && !guestOrderNo.trim()) {
      setGuestOrderNo(guestOrderNoSeed);
    }
  }, [guestNameSeed, guestOrderNoSeed, guestName, guestOrderNo]);

  const handleGuestLookup = async (e: FormEvent) => {
    e.preventDefault();
    setGuestError(null);
    if (!guestLookupClientSlug) {
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
          clientSlug: guestLookupClientSlug,
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
    <ShopLoginChrome
      subdomain={subdomain}
      callbackUrl={callbackUrl}
      shopClientSlug={resolvedClientSlug ?? clientInfo?.slug ?? clientSlugForGuest}
    >
      <div className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-xl shadow-slate-300/30">
        <ShopLoginHeader
          contextLoading={contextLoading}
          clientInfo={clientInfo}
          partnerCompanyName={partnerCompanyName}
          subdomain={subdomain}
          clientSlug={resolvedClientSlug ?? clientInfo?.slug ?? clientSlugForGuest}
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
              <SocialLoginButtons onKakao={() => handleOAuth("kakao")} onNaver={() => handleOAuth("naver")} />

              <LoginOrDivider />

              <div className="mt-6">
                <LoginTabBar
                  subdomain={subdomain}
                  callbackUrl={callbackUrl}
                  active={tab}
                  preserveSearchParams={searchParams}
                />
              </div>

              {tab === "member" ? (
                <MemberLoginForm
                  memberIdInputRef={memberIdInputRef}
                  memberId={memberId}
                  memberPw={memberPw}
                  showPw={showPw}
                  memberSubmitting={memberSubmitting}
                  memberError={memberError}
                  onMemberIdChange={setMemberId}
                  onMemberPwChange={setMemberPw}
                  onTogglePw={() => setShowPw((v) => !v)}
                  onSubmit={handleMemberLogin}
                />
              ) : (
                <GuestOrderLookupForm
                  clientSlugForGuest={guestLookupClientSlug}
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

"use client";

import { signIn } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { getStorefrontUrl } from "@/lib/app-url";
import { sanitizeCallbackUrlAgainstLoginLoop } from "@/lib/shop-callback-url";
import { useShopLoginContext } from "./_hooks/use-shop-login-context";
import { LoginOrDivider } from "./_components/login-or-divider";
import { LoginTabBar } from "./_components/login-tab-bar";
import { MemberLoginForm } from "./_components/member-login-form";
import { ShopLoginChrome } from "./_components/shop-login-chrome";
import { ShopLoginHeader } from "./_components/shop-login-header";
import { SocialLoginButtons } from "./_components/social-login-buttons";

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

  const searchQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set("callbackUrl", callbackUrl);
    return p.toString();
  }, [callbackUrl]);

  const { partnerCompanyName, clientInfo, loading: contextLoading } = useShopLoginContext(
    subdomain,
    callbackUrl
  );

  const partnerLine =
    (partnerCompanyName?.trim() || clientInfo?.name?.trim() || subdomain || "쇼핑몰") + " 임직원 로그인";

  const [showPw, setShowPw] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [memberPw, setMemberPw] = useState("");
  const [autoLogin, setAutoLogin] = useState(false);
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const handleOAuth = (provider: "kakao" | "naver") => {
    signIn(provider, { callbackUrl });
  };

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

              <LoginTabBar subdomain={subdomain} searchQuery={searchQuery} active="member" />

              <MemberLoginForm
                subdomain={subdomain}
                callbackUrl={callbackUrl}
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
            </>
          )}
        </div>
      </div>
    </ShopLoginChrome>
  );
}

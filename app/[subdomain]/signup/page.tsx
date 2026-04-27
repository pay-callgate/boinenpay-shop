"use client";

import { signIn } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";
import { getStorefrontUrl } from "@/lib/app-url";
import { sanitizeCallbackUrlAgainstLoginLoop } from "@/lib/shop-callback-url";

/**
 * 회원가입 진입 — 카카오·네이버 + 이메일 가입 보조.
 * /{subdomain}/signup
 */
export default function ShopSignupPage() {
  const params = useParams();
  const router = useRouter();
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

  const handleOAuth = (provider: "kakao" | "naver") => {
    signIn(provider, { callbackUrl });
  };

  return (
    <div className="min-h-[100dvh] bg-white px-5 py-8 max-w-md mx-auto flex flex-col">
      <div className="text-center mb-2">
        <p className="text-xs text-slate-500">{subdomain}</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">회원가입</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          아이디와 비밀번호 입력이 번거로우시죠? 카카오·네이버로 빠르게 시작하세요.
        </p>
      </div>

      <div className="flex flex-col gap-3 mt-6">
        <button
          type="button"
          onClick={() => handleOAuth("kakao")}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-4 text-sm font-semibold text-[#191919]"
        >
          카카오 1초 회원가입
        </button>
        <button
          type="button"
          onClick={() => handleOAuth("naver")}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#03C75A] px-4 py-4 text-sm font-semibold text-white"
        >
          네이버 1초 회원가입
        </button>
      </div>

      <div className="relative my-10">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-slate-400">또는</span>
        </div>
      </div>

      <div
        className="rounded-2xl bg-gradient-to-br from-violet-50 to-pink-50 p-8 text-center border border-slate-100"
        aria-hidden
      >
        <p className="text-4xl mb-2">🎁</p>
        <p className="text-sm font-medium text-slate-700">
          1초만에 가입하고 다양한 혜택을 받아보세요!
        </p>
      </div>

      <div className="mt-10">
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/signup/email?callbackUrl=${encodeURIComponent(callbackUrl)}`)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 text-sm font-medium text-slate-800"
        >
          ID/PW 입력이 필요한 회원가입
        </button>
      </div>

      <p className="mt-10 text-center text-xs text-slate-500">
        이미 계정이 있으신가요?{" "}
        <Link href={`/${subdomain}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="font-semibold text-slate-900 underline">
          로그인
        </Link>
      </p>

      <p className="mt-auto pt-8 text-[11px] text-center text-slate-400 leading-relaxed">
        첫 구매가 빨라지는 1초 회원가입
      </p>
    </div>
  );
}

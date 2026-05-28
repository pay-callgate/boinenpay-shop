"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ShopLoginClientInfo } from "../_hooks/use-shop-login-context";

type Props = {
  contextLoading: boolean;
  clientInfo: ShopLoginClientInfo | null;
  partnerCompanyName: string | null;
  subdomain: string;
};

/** 올드 스냅샷과 유사한 상단 라벤더 톤 헤더 (로고 + 파트너명 전용 쇼핑몰) */
export function ShopLoginHeader({
  contextLoading,
  clientInfo,
  partnerCompanyName,
  subdomain,
}: Props) {
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [clientInfo?.logo_url]);

  const displayName =
    clientInfo?.name?.trim() ||
    partnerCompanyName?.trim() ||
    subdomain ||
    "쇼핑몰";

  const showLogo = Boolean(clientInfo?.logo_url?.trim()) && !logoError;

  return (
    <div className="bg-gradient-to-b from-[#ebe4f4] via-[#f0ebf7] to-[#f6f3fa] px-6 pb-7 pt-8 text-center sm:px-8 sm:pt-9">
      {contextLoading ? (
        <div className="mx-auto mb-5 h-16 w-16 animate-pulse rounded-2xl bg-white/60" />
      ) : showLogo ? (
        <div className="relative mx-auto mb-5 h-16 w-16 overflow-hidden rounded-2xl border border-white/80 bg-white shadow-md">
          <Image
            src={clientInfo!.logo_url!}
            alt=""
            fill
            className="object-contain p-1"
            sizes="64px"
            unoptimized={
              clientInfo!.logo_url!.includes("supabase.co") ||
              clientInfo!.logo_url!.startsWith("http://localhost")
            }
            onError={() => setLogoError(true)}
          />
        </div>
      ) : (
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/60 bg-white/90 text-lg font-bold text-slate-600 shadow-md">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
      )}

      <h1 className="text-[1.35rem] font-bold leading-snug tracking-tight text-[#1e293b] sm:text-2xl">
        {displayName} 전용 쇼핑몰
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        고객님 환영합니다!
      </p>
    </div>
  );
}

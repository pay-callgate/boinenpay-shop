"use client";

import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  subdomain: string;
  /** 히스토리가 없을 때 등 예비 이동 경로(로그인 후 돌아갈 URL 등) */
  callbackUrl: string;
  /** 거래처 쇼핑몰 메인 `/` — 있으면 `/{subdomain}/{slug}`, 없으면 `/{subdomain}` */
  shopClientSlug?: string | null;
  children: React.ReactNode;
};

/** 바깥 그라데이션 + 뒤로(히스토리 백) / 홈(쇼핑몰 메인) 아이콘 + 카드는 children 에서 구성 */
export function ShopLoginChrome({
  subdomain,
  callbackUrl: _loginCallbackUrl,
  shopClientSlug,
  children,
}: Props) {
  const router = useRouter();
  const slug = shopClientSlug?.trim() || null;
  const shopHomePath = slug ? `/${subdomain}/${slug}` : `/${subdomain}`;

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-violet-50/90 via-fuchsia-50/35 to-slate-100/95">
      <div className="mx-auto flex w-full max-w-md flex-col px-4 pb-14 pt-6 sm:pt-10">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            aria-label="이전 화면으로 돌아가기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-100/90 bg-white/55 text-fuchsia-400/95 shadow-sm backdrop-blur-sm transition hover:border-fuchsia-200/85 hover:bg-violet-50/85 hover:text-fuchsia-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/45"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <Link
            href={shopHomePath}
            aria-label="쇼핑몰 홈으로 이동"
            title="쇼핑몰 홈"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-100/90 bg-white/55 text-fuchsia-400/95 shadow-sm backdrop-blur-sm transition hover:border-fuchsia-200/85 hover:bg-violet-50/85 hover:text-fuchsia-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/45"
          >
            <Home className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} aria-hidden />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

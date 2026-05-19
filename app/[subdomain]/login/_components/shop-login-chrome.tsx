"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  subdomain: string;
  /** 히스토리가 없을 때 등 예비 이동 경로(로그인 후 돌아갈 URL 등) */
  callbackUrl: string;
  /** 거래처 쇼핑몰 메인 `/` — 있으면 `/{subdomain}/{slug}`, 없으면 `/{subdomain}` */
  shopClientSlug?: string | null;
  children: React.ReactNode;
};

/** 바깥 그라데이션 + 돌아가기(히스토리 백) / 홈(쇼핑몰 메인) + 카드는 children 에서 구성 */
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
    <div className="min-h-[100dvh] bg-gradient-to-b from-violet-50/80 via-slate-50/90 to-slate-100/95">
      <div className="mx-auto flex w-full max-w-md flex-col px-4 pb-14 pt-6 sm:pt-10">
        <div className="mb-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-white/60 hover:text-slate-900"
          >
            ← 돌아가기
          </button>
          <Link
            href={shopHomePath}
            className="flex items-center justify-center rounded-lg px-2 py-1.5 text-lg leading-none text-slate-600 transition hover:bg-white/60 hover:text-slate-900"
            aria-label="쇼핑몰 홈으로 이동"
            title="쇼핑몰 홈"
          >
            <span aria-hidden>🏠</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

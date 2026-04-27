import Link from "next/link";
import { getStorefrontUrl } from "@/lib/app-url";

type Props = {
  subdomain: string;
  callbackUrl: string;
  children: React.ReactNode;
};

/** 바깥 그라데이션 + 돌아가기/홈 + 카드는 children 에서 구성 */
export function ShopLoginChrome({ subdomain, callbackUrl, children }: Props) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-violet-50/80 via-slate-50/90 to-slate-100/95">
      <div className="mx-auto flex w-full max-w-md flex-col px-4 pb-14 pt-6 sm:pt-10">
        <div className="mb-4 flex items-center justify-between text-sm">
          <Link
            href={callbackUrl}
            className="rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-white/60 hover:text-slate-900"
          >
            ← 돌아가기
          </Link>
          <Link
            href={getStorefrontUrl(subdomain)}
            className="rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-white/60 hover:text-slate-900"
            aria-label="쇼핑몰 홈"
          >
            홈
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

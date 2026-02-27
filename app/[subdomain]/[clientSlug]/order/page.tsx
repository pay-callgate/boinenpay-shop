"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * 주문서 페이지 - 새 UI는 /checkout 에서 제공.
 * /order 는 기존 링크/북마크 호환을 위해 /checkout 으로 리다이렉트.
 */
export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;

  useEffect(() => {
    if (subdomain && clientSlug) {
      router.replace(`/${subdomain}/${clientSlug}/checkout`);
    }
  }, [subdomain, clientSlug, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
      <p className="text-[#6B7280]">주문서로 이동 중...</p>
    </div>
  );
}

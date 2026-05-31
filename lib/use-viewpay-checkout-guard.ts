"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";

type CheckoutGuardParams = {
  clientId: string | null | undefined;
  subdomain: string;
  clientSlug: string;
  /** cancel=1 복귀 시 스킵 */
  skip?: boolean;
};

/**
 * checkout / guest-order — 서버 DB 기준 최근 paid 주문이면 complete로 유도
 * (sessionStorage·URL orderId 사용하지 않음)
 */
export function useViewpayCheckoutGuard({
  clientId,
  subdomain,
  clientSlug,
  skip = false,
}: CheckoutGuardParams): void {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (skip || ran.current) return;
    if (!clientId || !subdomain || !clientSlug) return;
    ran.current = true;

    const qs = new URLSearchParams({
      clientId,
      subdomain,
      clientSlug,
    });

    shopFetch(`/api/payment/viewpay/checkout-guard?${qs.toString()}`, {
      handleSessionExpiry: false,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.shouldRedirect || typeof data.completePath !== "string") return;
        toast("이미 결제된 주문입니다.", "default");
        router.replace(data.completePath);
      })
      .catch(() => {
        // ignore — 주문서 정상 표시
      });
  }, [clientId, subdomain, clientSlug, skip, router]);
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";
import { VIEWPAY_CHECKOUT_GUARD_REDIRECT_ENABLED } from "@/lib/viewpay-checkout-guard-config";
import {
  CHECKOUT_GUARD_INITIAL,
  type CheckoutGuardApiResponse,
  type CheckoutGuardState,
} from "@/lib/viewpay-checkout-context";

type UseViewpayCheckoutGuardParams = {
  clientId: string | null | undefined;
  subdomain: string;
  clientSlug: string;
  cartLoading: boolean;
  cartItemCount: number;
  pendingOrderId?: string | null;
};

/**
 * cart가 비었고 cartLoading === false 일 때만 서버 최근 주문 조회.
 * cart에 상품 있으면 phase=idle (신규 결제 보호).
 *
 * VIEWPAY_CHECKOUT_GUARD_REDIRECT_ENABLED === false 이면 API·리다이렉트를 수행하지 않고
 * order/complete + webhook/sync-status 폴링만으로 결제 완료를 기다립니다.
 */
export function useViewpayCheckoutGuard({
  clientId,
  subdomain,
  clientSlug,
  cartLoading,
  cartItemCount,
  pendingOrderId = null,
}: UseViewpayCheckoutGuardParams): CheckoutGuardState {
  const router = useRouter();
  const [state, setState] = useState<CheckoutGuardState>(CHECKOUT_GUARD_INITIAL);
  const paidRedirectStarted = useRef(false);

  const skipGuard = cartItemCount > 0 || Boolean(pendingOrderId);

  useEffect(() => {
    if (!VIEWPAY_CHECKOUT_GUARD_REDIRECT_ENABLED) {
      setState(CHECKOUT_GUARD_INITIAL);
      return;
    }

    if (!clientId || !subdomain || !clientSlug) return;
    if (cartLoading || skipGuard) {
      if (skipGuard) setState(CHECKOUT_GUARD_INITIAL);
      return;
    }

    let cancelled = false;
    setState({ phase: "loading", pendingOrder: null });

    const qs = new URLSearchParams({ clientId, subdomain, clientSlug });

    shopFetch(`/api/payment/viewpay/checkout-guard?${qs.toString()}`, {
      handleSessionExpiry: false,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CheckoutGuardApiResponse | null) => {
        if (cancelled) return;

        if (!data) {
          setState({ phase: "empty", pendingOrder: null });
          return;
        }

        if (data.scenario === "paid" && data.completePath) {
          if (!paidRedirectStarted.current) {
            paidRedirectStarted.current = true;
            toast("이미 결제된 주문입니다.", "info");
            setState({ phase: "paid_redirect", pendingOrder: data.order ?? null });
            router.replace(data.completePath);
          }
          return;
        }

        if (data.scenario === "pending" && data.order) {
          setState({ phase: "pending", pendingOrder: data.order });
          return;
        }

        setState({ phase: "empty", pendingOrder: null });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: "empty", pendingOrder: null });
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, subdomain, clientSlug, cartLoading, skipGuard, router]);

  if (!VIEWPAY_CHECKOUT_GUARD_REDIRECT_ENABLED) {
    return CHECKOUT_GUARD_INITIAL;
  }
  if (skipGuard) return CHECKOUT_GUARD_INITIAL;
  if (cartLoading) return { phase: "loading", pendingOrder: null };
  return state;
}

export type { CheckoutResumeOrder } from "@/lib/viewpay-checkout-context";

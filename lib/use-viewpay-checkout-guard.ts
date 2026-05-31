"use client";

import { useEffect, useRef, useState } from "react";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";
import {
  VIEWPAY_CHECKOUT_GUARD_PAID_AUTO_REDIRECT_ENABLED,
  VIEWPAY_CHECKOUT_GUARD_PENDING_PROBE_ENABLED,
} from "@/lib/viewpay-checkout-guard-config";
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
  /** cancel=1 복귀 시 probe 스킵 */
  skip?: boolean;
  /** 변경 시 probe 재실행 (결제 취소 복귀 등) */
  reprobeKey?: number;
};

/**
 * checkout / guest-order 진입 시 서버 최근 주문 1건 조회.
 * pending → 선택형 패널(pending_offer), paid → 안내만(paid_notice, 자동 이동 없음).
 */
export function useViewpayCheckoutGuard({
  clientId,
  subdomain,
  clientSlug,
  cartLoading,
  skip = false,
  reprobeKey = 0,
}: UseViewpayCheckoutGuardParams): CheckoutGuardState {
  const [state, setState] = useState<CheckoutGuardState>(CHECKOUT_GUARD_INITIAL);
  const probeStarted = useRef(false);

  useEffect(() => {
    probeStarted.current = false;
    setState(CHECKOUT_GUARD_INITIAL);
  }, [reprobeKey]);

  useEffect(() => {
    if (!VIEWPAY_CHECKOUT_GUARD_PENDING_PROBE_ENABLED || skip) {
      setState(CHECKOUT_GUARD_INITIAL);
      return;
    }
    if (!clientId || !subdomain || !clientSlug || cartLoading) return;
    if (probeStarted.current) return;
    probeStarted.current = true;

    let cancelled = false;
    setState({ phase: "loading", pendingOrder: null, completePath: null });

    const qs = new URLSearchParams({ clientId, subdomain, clientSlug });

    shopFetch(`/api/payment/viewpay/checkout-guard?${qs.toString()}`, {
      handleSessionExpiry: false,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CheckoutGuardApiResponse | null) => {
        if (cancelled) return;

        if (!data || data.scenario === "none" || data.scenario === "no_identity") {
          setState({ phase: "idle", pendingOrder: null, completePath: null });
          return;
        }

        if (data.scenario === "paid" && data.order) {
          toast("이미 결제된 주문이 있습니다.", "info");
          setState({
            phase: VIEWPAY_CHECKOUT_GUARD_PAID_AUTO_REDIRECT_ENABLED
              ? "paid_redirect"
              : "paid_notice",
            pendingOrder: data.order,
            completePath: data.completePath ?? null,
          });
          return;
        }

        if (data.scenario === "pending" && data.order) {
          setState({
            phase: "pending_offer",
            pendingOrder: data.order,
            completePath: null,
          });
          return;
        }

        setState({ phase: "idle", pendingOrder: null, completePath: null });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: "idle", pendingOrder: null, completePath: null });
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, subdomain, clientSlug, cartLoading, skip, reprobeKey]);

  if (!VIEWPAY_CHECKOUT_GUARD_PENDING_PROBE_ENABLED || skip) {
    return CHECKOUT_GUARD_INITIAL;
  }
  if (cartLoading) return { phase: "loading", pendingOrder: null, completePath: null };
  return state;
}

export type { CheckoutResumeOrder } from "@/lib/viewpay-checkout-context";

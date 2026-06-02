"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import {
  ORDER_PAYMENT_PAGE_BG,
  ORDER_PAYMENT_WHITE_CARD,
  OrderPaymentFailedView,
} from "@/components/shop/OrderPaymentFailedView";
import {
  buildClientCheckoutReturnUrl,
  resolveCheckoutReturnItemsQuery,
  resolveCheckoutReturnPath,
} from "@/lib/resolve-checkout-return-url";
import { shopFetch } from "@/lib/shop-fetch";

/**
 * ViewPay Track 2: 실제 PG/시스템 오류 전용 페이지
 * Query: orderId, code?, reason?, checkoutReturnPath?, items?, guestToken?, sig?
 */
export default function OrderFailedPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const orderId = searchParams?.get("orderId")?.trim() ?? "";
  const errorCode = searchParams?.get("code")?.trim() ?? "";
  const errorReason = searchParams?.get("reason")?.trim() ?? "";
  const guestToken = searchParams?.get("guestToken")?.trim() ?? "";
  const guestSig = searchParams?.get("sig")?.trim() ?? "";

  const queryReturnPath = searchParams?.get("checkoutReturnPath")?.trim() as
    | "checkout"
    | "guest-order"
    | undefined;
  const queryItems = searchParams?.get("items")?.trim() ?? "";

  const [returnPath, setReturnPath] = useState<"checkout" | "guest-order">(
    queryReturnPath === "guest-order" ? "guest-order" : "checkout"
  );
  const [itemsQuery, setItemsQuery] = useState(queryItems);

  useEffect(() => {
    if (!orderId || (queryReturnPath && queryItems)) return;
    let cancelled = false;
    const orderUrl =
      guestToken && guestSig
        ? `/api/orders/${orderId}?guestToken=${encodeURIComponent(guestToken)}&sig=${encodeURIComponent(guestSig)}`
        : `/api/orders/${orderId}`;
    shopFetch(orderUrl, { handleSessionExpiry: !(guestToken && guestSig) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.order) return;
        const order = data.order as {
          is_guest?: boolean | null;
          checkout_cart_item_ids?: string[] | null;
        };
        if (!queryReturnPath) {
          setReturnPath(resolveCheckoutReturnPath(order));
        }
        if (!queryItems) {
          const resolved = resolveCheckoutReturnItemsQuery(order);
          if (resolved) setItemsQuery(resolved);
        }
      })
      .catch(() => {
        // 쿼리 기본값 유지
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, guestToken, guestSig, queryReturnPath, queryItems]);

  const handleReturnToCheckout = useCallback(() => {
    router.push(
      buildClientCheckoutReturnUrl({
        subdomain,
        clientSlug,
        checkoutReturnPath: returnPath,
        itemsQuery: itemsQuery || undefined,
      })
    );
  }, [router, subdomain, clientSlug, returnPath, itemsQuery]);

  return (
    <OrderGuard
      partnerId={partner?.id ?? undefined}
      shopClientId={client?.id}
      shopClientName={client?.name ?? undefined}
      requireAuth={false}
      blockAffiliationMismatch={false}
    >
      <div
        className="min-h-[60vh] w-full"
        style={{
          backgroundColor: ORDER_PAYMENT_PAGE_BG,
          paddingBottom: `calc(24px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <div className="px-4 pt-4">
          <div className={ORDER_PAYMENT_WHITE_CARD}>
            {!orderId ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <p className="text-center text-[#6B7280]">잘못된 접근입니다.</p>
                <button
                  type="button"
                  onClick={() => router.push(`/${subdomain}/${clientSlug}`)}
                  className="rounded-xl px-6 py-2 font-medium text-white"
                  style={{ backgroundColor: "#D6A8E0" }}
                >
                  쇼핑몰 홈으로
                </button>
              </div>
            ) : (
              <OrderPaymentFailedView
                errorCode={errorCode || undefined}
                errorReason={errorReason || undefined}
                onReturnToCheckout={handleReturnToCheckout}
              />
            )}
          </div>
        </div>
      </div>
    </OrderGuard>
  );
}

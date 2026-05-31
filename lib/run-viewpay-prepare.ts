"use client";

import { shopFetch } from "@/lib/shop-fetch";
import { assignLocationHrefForPayment } from "@/lib/kakao-in-app-browser";
import { confirmKakaoExternalPaymentIfNeeded } from "@/lib/confirm-kakao-external-payment-client";
import { toast } from "@/components/shop/ToastContext";

export type ViewpayPrepareParams = {
  subdomain: string;
  clientSlug: string;
  orderId: string;
  orderNo: string;
  amount: number;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  productName?: string;
  cancelPath: "checkout" | "guest-order";
  itemsQuery?: string;
  isGuestCheckout?: boolean;
  guestCheckoutToken?: string;
  paymentSignature?: string;
};

/**
 * ViewPay prepare API 호출 후 PG URL로 이동 (checkout / guest-order / 가이드 재개 공통)
 */
export async function runViewpayPreparePayment(
  params: ViewpayPrepareParams
): Promise<boolean> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  let returnUrl = `${origin}/${params.subdomain}/${params.clientSlug}/order/complete?orderId=${params.orderId}`;
  const guestTok = params.guestCheckoutToken?.trim();
  const paySig = params.paymentSignature?.trim();
  if (guestTok && paySig) {
    returnUrl += `&guestToken=${encodeURIComponent(guestTok)}&sig=${encodeURIComponent(paySig)}`;
  }

  let cancelUrl = `${origin}/${params.subdomain}/${params.clientSlug}/${params.cancelPath}?cancel=1`;
  if (params.cancelPath === "guest-order" && params.itemsQuery?.trim()) {
    cancelUrl += `&items=${encodeURIComponent(params.itemsQuery.trim())}`;
  }
  if (params.cancelPath === "checkout" && params.isGuestCheckout) {
    cancelUrl += "&guest=1";
  }

  const prepareBody: Record<string, unknown> = {
    orderId: params.orderId,
    orderNo: params.orderNo,
    amount: params.amount,
    productName: params.productName?.trim() || "주문상품",
    returnUrl,
    cancelUrl,
    buyerName: params.buyerName.trim() || "구매자",
    buyerPhone: params.buyerPhone.trim(),
    buyerEmail: params.buyerEmail?.trim() ?? "",
  };
  if (guestTok && paySig) {
    prepareBody.guestCheckoutToken = guestTok;
    prepareBody.paymentSignature = paySig;
  }

  const prepareRes = await shopFetch("/api/payment/viewpay/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prepareBody),
    handleSessionExpiry: !(guestTok && paySig),
  });
  const prepareData = (await prepareRes.json().catch(() => ({}))) as {
    success?: boolean;
    redirectUrl?: string;
    message?: string;
  };

  if (prepareRes.ok && prepareData.success && prepareData.redirectUrl) {
    const confirmed = await confirmKakaoExternalPaymentIfNeeded();
    if (!confirmed) return false;
    assignLocationHrefForPayment(String(prepareData.redirectUrl));
    return true;
  }

  toast(
    prepareData.message ||
      "결제창을 열 수 없습니다. 잠시 후 다시 시도해 주세요.",
    "error"
  );
  return false;
}

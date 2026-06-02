import type { ViewpayFailureClassification } from "@/lib/viewpay-payment-outcome";

export type CheckoutReturnOrder = {
  is_guest?: boolean | null;
  checkout_cart_item_ids?: string[] | null;
};

export type ViewpayFailureWithCheckout = ViewpayFailureClassification & {
  success: false;
  checkoutReturnPath: "checkout" | "guest-order";
  itemsQuery?: string;
};

export function resolveCheckoutReturnPath(
  order: CheckoutReturnOrder
): "checkout" | "guest-order" {
  return order.is_guest ? "guest-order" : "checkout";
}

export function resolveCheckoutReturnItemsQuery(
  order: CheckoutReturnOrder
): string | undefined {
  const ids = order.checkout_cart_item_ids;
  if (!Array.isArray(ids) || ids.length === 0) return undefined;
  const joined = ids.map((id) => String(id).trim()).filter(Boolean).join(",");
  return joined || undefined;
}

export function appendViewpayFailureCheckoutHints(
  classification: ViewpayFailureClassification,
  order: CheckoutReturnOrder
): ViewpayFailureWithCheckout {
  const itemsQuery = resolveCheckoutReturnItemsQuery(order);
  return {
    success: false,
    ...classification,
    checkoutReturnPath: resolveCheckoutReturnPath(order),
    ...(itemsQuery ? { itemsQuery } : {}),
  };
}

/** 클라이언트: Track 1 주문서 복귀 URL */
export function buildClientCheckoutReturnUrl(params: {
  subdomain: string;
  clientSlug: string;
  checkoutReturnPath: "checkout" | "guest-order";
  itemsQuery?: string;
  error?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.error) qs.set("error", params.error);
  if (params.itemsQuery) qs.set("items", params.itemsQuery);
  const q = qs.toString();
  return `/${params.subdomain}/${params.clientSlug}/${params.checkoutReturnPath}${q ? `?${q}` : ""}`;
}

/** 클라이언트: Track 2 결제 실패 페이지 URL */
export function buildClientOrderFailedUrl(params: {
  subdomain: string;
  clientSlug: string;
  orderId: string;
  code?: string;
  reason?: string;
  guestToken?: string;
  guestSig?: string;
  checkoutReturnPath?: "checkout" | "guest-order";
  itemsQuery?: string;
}): string {
  const qs = new URLSearchParams({ orderId: params.orderId });
  if (params.code) qs.set("code", params.code);
  if (params.reason) qs.set("reason", params.reason);
  if (params.checkoutReturnPath) qs.set("checkoutReturnPath", params.checkoutReturnPath);
  if (params.itemsQuery) qs.set("items", params.itemsQuery);
  if (params.guestToken) qs.set("guestToken", params.guestToken);
  if (params.guestSig) qs.set("sig", params.guestSig);
  return `/${params.subdomain}/${params.clientSlug}/order/failed?${qs.toString()}`;
}

/** user_cancel / system_error API·sync 응답 → 클라이언트 리다이렉트 경로 */
export function resolveViewpayFailureRedirectPath(params: {
  subdomain: string;
  clientSlug: string;
  orderId: string;
  payload: Record<string, unknown>;
  guestToken?: string;
  guestSig?: string;
}): string {
  const outcome = params.payload.outcome as string | undefined;
  const checkoutReturnPath = params.payload.checkoutReturnPath as
    | "checkout"
    | "guest-order"
    | undefined;
  const itemsQuery = params.payload.itemsQuery as string | undefined;

  if (outcome === "user_cancel" && checkoutReturnPath) {
    return buildClientCheckoutReturnUrl({
      subdomain: params.subdomain,
      clientSlug: params.clientSlug,
      checkoutReturnPath,
      itemsQuery,
      error: "user_cancel",
    });
  }

  return buildClientOrderFailedUrl({
    subdomain: params.subdomain,
    clientSlug: params.clientSlug,
    orderId: params.orderId,
    code: (params.payload.code as string | undefined) ?? undefined,
    reason: (params.payload.message as string | undefined) ?? undefined,
    guestToken: params.guestToken,
    guestSig: params.guestSig,
    checkoutReturnPath,
    itemsQuery,
  });
}

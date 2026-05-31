import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyGuestCheckout, signGuestCheckout } from "@/lib/guest-checkout-signature";
import {
  syncViewpayOrderPayment,
  type ViewpayOrderRow,
} from "@/lib/viewpay-payment-sync";

const ORDER_SELECT =
  "id, order_no, total_amount, payment_status, is_guest, guest_checkout_token, viewpay_merchant_order_no, user_id, client_id, updated_at, created_at, orderer_name, shipping_phone, shipping_name, guest_orderer_email, checkout_cart_item_ids";

/** PG 복귀 직후 paid 리다이렉트 판단 (checkout/guest-order 방어) */
export const VIEWPAY_RECENT_PAID_WINDOW_MS = 30 * 60 * 1000;

/** PG 복귀·결제 이어가기 pending 판단 (동일 30분) */
export const VIEWPAY_RECENT_PENDING_WINDOW_MS = VIEWPAY_RECENT_PAID_WINDOW_MS;

export type ViewpayOrderAccess = {
  ok: true;
  order: ViewpayOrderRow & { client_id?: string; updated_at?: string; created_at?: string };
} | { ok: false; status: number; message: string };

export function authorizeViewpayOrderAccess(
  order: ViewpayOrderRow,
  opts: {
    sessionUserId?: string | null;
    guestToken?: string | null;
    guestSig?: string | null;
  }
): { ok: true } | { ok: false; message: string; status: number } {
  if (order.is_guest) {
    const token = opts.guestToken?.trim() ?? "";
    const sig = opts.guestSig?.trim() ?? "";
    const okGuest =
      order.guest_checkout_token &&
      token &&
      sig &&
      order.guest_checkout_token === token &&
      verifyGuestCheckout(order.id, token, sig);
    if (!okGuest) {
      return {
        ok: false,
        status: 401,
        message: "로그인이 필요하거나 비회원 결제 인증이 올바르지 않습니다.",
      };
    }
    return { ok: true };
  }

  if (opts.sessionUserId && order.user_id === opts.sessionUserId) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    message: "해당 주문에 대한 권한이 없습니다.",
  };
}

export async function loadViewpayOrderById(
  supabase: SupabaseClient,
  orderId: string
): Promise<ViewpayOrderAccess> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 404, message: "주문을 찾을 수 없습니다." };
  }
  return { ok: true, order: data as ViewpayOrderRow & { client_id?: string; updated_at?: string; created_at?: string } };
}

export function buildOrderCompletePath(
  subdomain: string,
  clientSlug: string,
  order: Pick<ViewpayOrderRow, "id" | "is_guest" | "guest_checkout_token">
): string {
  const base = `/${subdomain}/${clientSlug}/order/complete?orderId=${encodeURIComponent(order.id)}`;
  if (order.is_guest && order.guest_checkout_token) {
    const token = order.guest_checkout_token;
    const sig = signGuestCheckout(order.id, token);
    return `${base}&guestToken=${encodeURIComponent(token)}&sig=${encodeURIComponent(sig)}`;
  }
  return base;
}

export function isRecentlyPaidOrder(
  order: { payment_status: string; updated_at?: string | null },
  nowMs = Date.now()
): boolean {
  if (order.payment_status !== "paid") return false;
  const updated = order.updated_at ? new Date(order.updated_at).getTime() : NaN;
  if (!Number.isFinite(updated)) return false;
  return nowMs - updated >= 0 && nowMs - updated < VIEWPAY_RECENT_PAID_WINDOW_MS;
}

function recentOrderTimestamp(order: {
  updated_at?: string | null;
  created_at?: string | null;
}): number {
  const updated = order.updated_at ? new Date(order.updated_at).getTime() : NaN;
  if (Number.isFinite(updated)) return updated;
  const created = order.created_at ? new Date(order.created_at).getTime() : NaN;
  return Number.isFinite(created) ? created : NaN;
}

export function isRecentlyPendingOrder(
  order: {
    payment_status: string;
    updated_at?: string | null;
    created_at?: string | null;
  },
  nowMs = Date.now()
): boolean {
  if (order.payment_status !== "pending") return false;
  const ts = recentOrderTimestamp(order);
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts >= 0 && nowMs - ts < VIEWPAY_RECENT_PENDING_WINDOW_MS;
}

/** 세션(회원) 또는 장바구니 쿠키(비회원) 기준 최근 주문 1건 */
export async function findRecentCheckoutOrder(
  supabase: SupabaseClient,
  params: {
    clientId: string;
    sessionUserId?: string | null;
    guestCartSessionId?: string | null;
  }
): Promise<(ViewpayOrderRow & { client_id?: string; updated_at?: string; created_at?: string }) | null> {
  const { clientId, sessionUserId, guestCartSessionId } = params;

  if (sessionUserId) {
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("client_id", clientId)
      .eq("user_id", sessionUserId)
      .eq("is_guest", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as ViewpayOrderRow & { updated_at?: string; created_at?: string } | null;
  }

  if (guestCartSessionId) {
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("client_id", clientId)
      .eq("is_guest", true)
      .eq("guest_cart_session_id", guestCartSessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as ViewpayOrderRow & { updated_at?: string; created_at?: string } | null;
  }

  return null;
}

export type ViewpaySyncStatusResult = {
  success: boolean;
  status: "paid" | "pending" | "failed" | "unknown";
  orderId: string;
  orderNo?: string;
  cgTid?: string;
  message?: string;
  syncAttempted?: boolean;
  alreadyPaid?: boolean;
  newrun?: { success: boolean; message?: string; skipped?: boolean };
};

export async function getViewpaySyncStatus(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    sessionUserId?: string | null;
    guestToken?: string | null;
    guestSig?: string | null;
    cgTid?: string | null;
    doSync: boolean;
  }
): Promise<{ httpStatus: number; body: ViewpaySyncStatusResult }> {
  const loaded = await loadViewpayOrderById(supabase, params.orderId);
  if (!loaded.ok) {
    return {
      httpStatus: loaded.status,
      body: {
        success: false,
        status: "unknown",
        orderId: params.orderId,
        message: loaded.message,
      },
    };
  }

  const order = loaded.order;
  const auth = authorizeViewpayOrderAccess(order, {
    sessionUserId: params.sessionUserId,
    guestToken: params.guestToken,
    guestSig: params.guestSig,
  });
  if (!auth.ok) {
    return {
      httpStatus: auth.status,
      body: {
        success: false,
        status: "unknown",
        orderId: params.orderId,
        message: auth.message,
      },
    };
  }

  let paymentStatus = order.payment_status;
  let syncAttempted = false;
  let syncCgTid = params.cgTid?.trim() || undefined;
  let newrun: ViewpaySyncStatusResult["newrun"];

  if (paymentStatus !== "paid" && params.doSync) {
    syncAttempted = true;
    const syncResult = await syncViewpayOrderPayment(supabase, {
      orderId: order.id,
      cgTid: syncCgTid,
      source: "api",
    });
    if (syncResult.ok) {
      paymentStatus = "paid";
      syncCgTid = syncResult.cgTid;
      newrun = syncResult.newrun;
    } else if (syncResult.action !== "viewpay_payment_sync_verify_failed") {
      // pending 유지 — webhook 지연 등
    }
  }

  if (paymentStatus === "paid") {
    return {
      httpStatus: 200,
      body: {
        success: true,
        status: "paid",
        orderId: order.id,
        orderNo: order.order_no,
        cgTid: syncCgTid,
        syncAttempted,
        alreadyPaid: !syncAttempted,
        ...(newrun ? { newrun } : {}),
      },
    };
  }

  if (paymentStatus === "failed" || paymentStatus === "cancelled") {
    return {
      httpStatus: 200,
      body: {
        success: true,
        status: "failed",
        orderId: order.id,
        orderNo: order.order_no,
        syncAttempted,
        message: "결제가 완료되지 않았습니다.",
      },
    };
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      status: "pending",
      orderId: order.id,
      orderNo: order.order_no,
      syncAttempted,
      message: "결제 확인 중입니다.",
    },
  };
}

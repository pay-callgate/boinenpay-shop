import { logger } from "@/lib/logger";
import { viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";
import {
  extractCgTidFromViewpayPayload,
  extractMerchantOrderNoFromViewpayPayload,
  extractOrderIdFromViewpayPayload,
  finalizeViewpayOrderPaid,
  verifyViewpayPaymentAgainstOrder,
} from "@/lib/viewpay-order-completion";
import {
  classifyViewpayPaymentFailure,
  type ViewpayPaymentOutcome,
} from "@/lib/viewpay-payment-outcome";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOG = "[ViewPay:PaymentSync]";

export type ViewpayOrderRow = {
  id: string;
  order_no: string;
  total_amount: number;
  payment_status: string;
  is_guest?: boolean | null;
  guest_checkout_token?: string | null;
  viewpay_merchant_order_no?: string | null;
  user_id?: string | null;
};

export type ViewpaySyncSource = "webhook" | "complete" | "guest-sync" | "api";

export type ViewpayPaymentSyncResult =
  | {
      ok: true;
      orderId: string;
      orderNo: string;
      cgTid: string;
      alreadyPaid?: boolean;
      newrun?: { success: boolean; message?: string; skipped?: boolean };
    }
  | { ok: false; action: string; message: string; outcome?: ViewpayPaymentOutcome; code?: string };

const ORDER_SELECT =
  "id, order_no, total_amount, payment_status, is_guest, guest_checkout_token, viewpay_merchant_order_no, user_id";

async function fetchPaymentInfoByCgTid(
  cgTid: string,
  orderId?: string
): Promise<{ paymentInfo: Record<string, unknown> | null; lastErr: string | null }> {
  try {
    logger.info(`${LOG} get-payment-info(cgTid)`, {
      action: "viewpay_payment_sync_get_info_cgtid",
      data: { cgTid, orderId: orderId ?? null },
    });
    const body: Record<string, string> = { cgTid };
    if (orderId?.trim()) body.orderId = orderId.trim();
    const paymentInfo = await viewpayPost("/v1/gw/get-payment-info", body);
    return { paymentInfo, lastErr: null };
  } catch (err) {
    if ((err as Error & { response?: { status: number } }).response?.status === 401) {
      clearViewpayTokenCache();
    }
    return { paymentInfo: null, lastErr: (err as Error).message };
  }
}

async function fetchPaymentInfoByMerchantNo(
  orderId: string,
  merchantNo: string
): Promise<{ paymentInfo: Record<string, unknown> | null; lastErr: string | null }> {
  const attempts: Record<string, unknown>[] = [
    { orderNo: merchantNo, orderId },
    { products: { orderNo: merchantNo }, orderId },
  ];
  let lastErr: string | null = null;
  for (const payload of attempts) {
    try {
      logger.info(`${LOG} get-payment-info(merchantNo)`, {
        action: "viewpay_payment_sync_get_info_merchant",
        data: { orderId, keys: Object.keys(payload) },
      });
      const paymentInfo = await viewpayPost("/v1/gw/get-payment-info", payload);
      return { paymentInfo, lastErr: null };
    } catch (err) {
      if ((err as Error & { response?: { status: number } }).response?.status === 401) {
        clearViewpayTokenCache();
      }
      lastErr = (err as Error).message;
      logger.warn(`${LOG} get-payment-info 실패`, {
        action: "viewpay_payment_sync_get_info_merchant_failed",
        data: { orderId, error: lastErr },
      });
    }
  }
  return { paymentInfo: null, lastErr };
}

/** get-payment-info 응답·힌트로 orders 행 조회 */
export async function resolveViewpayOrderFromPaymentInfo(
  supabase: SupabaseClient,
  paymentInfo: Record<string, unknown>,
  hints: { cgTid: string; orderId?: string | null }
): Promise<ViewpayOrderRow | null> {
  const orderIdHint = hints.orderId?.trim();
  if (orderIdHint) {
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", orderIdHint)
      .maybeSingle();
    if (data) return data as ViewpayOrderRow;
  }

  const metaOrderId = extractOrderIdFromViewpayPayload(paymentInfo);
  if (metaOrderId) {
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", metaOrderId)
      .maybeSingle();
    if (data) return data as ViewpayOrderRow;
  }

  const merchantNo = extractMerchantOrderNoFromViewpayPayload(paymentInfo);
  if (merchantNo) {
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("viewpay_merchant_order_no", merchantNo)
      .maybeSingle();
    if (data) return data as ViewpayOrderRow;
  }

  const cgTid = hints.cgTid.trim();
  if (cgTid) {
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("cg_tid", cgTid)
      .maybeSingle();
    if (data) return data as ViewpayOrderRow;
  }

  return null;
}

/**
 * ViewPay 승인 → CallLink DB 반영 (webhook / complete / guest-sync 공통)
 * cgTid 수신 시 반드시 get-payment-info 교차 검증 후 finalize.
 */
export async function syncViewpayOrderPayment(
  supabase: SupabaseClient,
  params: {
    cgTid?: string | null;
    orderId?: string | null;
    source: ViewpaySyncSource;
  }
): Promise<ViewpayPaymentSyncResult> {
  const source = params.source;
  const cgTidHint = params.cgTid?.trim() ?? "";
  const orderIdHint = params.orderId?.trim() ?? "";

  if (!cgTidHint && !orderIdHint) {
    return {
      ok: false,
      action: "viewpay_payment_sync_bad_request",
      message: "cgTid 또는 orderId가 필요합니다.",
    };
  }

  let order: ViewpayOrderRow | null = null;
  let paymentInfo: Record<string, unknown> | null = null;
  let lastErr: string | null = null;

  if (cgTidHint) {
    const res = await fetchPaymentInfoByCgTid(cgTidHint, orderIdHint || undefined);
    paymentInfo = res.paymentInfo;
    lastErr = res.lastErr;
    if (paymentInfo) {
      order = await resolveViewpayOrderFromPaymentInfo(supabase, paymentInfo, {
        cgTid: cgTidHint,
        orderId: orderIdHint || undefined,
      });
    }
  }

  if (!order && orderIdHint) {
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", orderIdHint)
      .maybeSingle();
    if (data) order = data as ViewpayOrderRow;
  }

  if (!paymentInfo && order?.viewpay_merchant_order_no?.trim()) {
    const res = await fetchPaymentInfoByMerchantNo(
      order.id,
      order.viewpay_merchant_order_no.trim()
    );
    paymentInfo = res.paymentInfo;
    lastErr = res.lastErr ?? lastErr;
  }

  if (!order) {
    logger.warn(`${LOG} 주문 매칭 실패`, {
      action: "viewpay_payment_sync_order_not_found",
      data: { source, cgTid: cgTidHint, orderId: orderIdHint },
    });
    return {
      ok: false,
      action: "viewpay_payment_sync_order_not_found",
      message: lastErr || "결제와 매칭되는 주문을 찾을 수 없습니다.",
    };
  }

  if (order.payment_status === "paid") {
    logger.info(`${LOG} 이미 paid`, {
      action: "viewpay_payment_sync_idempotent",
      data: { source, orderId: order.id, cgTid: cgTidHint },
    });
    return {
      ok: true,
      orderId: order.id,
      orderNo: order.order_no,
      cgTid: cgTidHint || order.viewpay_merchant_order_no || "",
      alreadyPaid: true,
    };
  }

  if (!paymentInfo) {
    return {
      ok: false,
      action: "viewpay_payment_sync_get_info_failed",
      message:
        lastErr ||
        "ViewPay에서 결제 정보를 조회하지 못했습니다.",
    };
  }

  const cgTid =
    cgTidHint ||
    extractCgTidFromViewpayPayload(paymentInfo) ||
    "";
  if (!cgTid) {
    logger.warn(`${LOG} cgTid 추출 실패`, {
      action: "viewpay_payment_sync_no_cgtid",
      data: { source, orderId: order.id },
    });
    return {
      ok: false,
      action: "viewpay_payment_sync_no_cgtid",
      message: "결제 조회 응답에서 거래 ID(cgTid)를 찾지 못했습니다.",
    };
  }

  const verified = verifyViewpayPaymentAgainstOrder(
    paymentInfo,
    Number(order.total_amount) || 0
  );
  if (!verified.ok) {
    logger.warn(`${LOG} 교차 검증 실패`, {
      action: "viewpay_payment_sync_verify_failed",
      data: { source, orderId: order.id, cgTid, message: verified.message },
    });
    const classification = classifyViewpayPaymentFailure({
      paymentInfo,
      message: verified.message,
    });
    return {
      ok: false,
      action: "viewpay_payment_sync_verify_failed",
      message: verified.message,
      outcome: classification.outcome,
      code: classification.code,
    };
  }

  try {
    const { newrun } = await finalizeViewpayOrderPaid(supabase, {
      orderId: order.id,
      orderNo: order.order_no,
      totalAmount: Number(order.total_amount) || 0,
      cgTid,
    });
    logger.info(`${LOG} 성공`, {
      action: "viewpay_payment_sync_success",
      data: { source, orderId: order.id, cgTid },
    });
    return {
      ok: true,
      orderId: order.id,
      orderNo: order.order_no,
      cgTid,
      ...(newrun ? { newrun } : {}),
    };
  } catch (err) {
    const msg = (err as Error).message || "주문 반영에 실패했습니다.";
    logger.error(`${LOG} finalize 실패`, {
      action: "viewpay_payment_sync_finalize_failed",
      data: { source, orderId: order.id, cgTid, error: msg },
    });
    return {
      ok: false,
      action: "viewpay_payment_sync_finalize_failed",
      message: msg,
    };
  }
}

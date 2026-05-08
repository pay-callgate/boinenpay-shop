import { logger } from "@/lib/logger";
import { viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";
import { submitNewrunOrder } from "@/lib/newrun/submit-order";
import { recordOrderPartnerNotifyEventSafe } from "@/lib/order-partner-notify-events";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOG = "[ViewPay:Finalize]";

/** ViewPay 결제 성공 상태값 (complete 라우트와 동일) */
export const PAYMENT_SUCCESS_STATUSES = [
  "0000",
  "PG_APPROVAL_SUCCESS",
  "PG_MODULE_SUCCESS",
  "PG_MODULE_VIRACC_ISSUE_SUCCESS",
];

export function normalizePaymentStatus(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") return raw.trim() || undefined;
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const s = (obj.code ?? obj.status ?? obj.value ?? obj.paymentStatus) as string | undefined;
    return typeof s === "string" ? s.trim() : undefined;
  }
  return undefined;
}

/** get-payment-info 전체 응답에서 결제 상태 문자열 추출 */
export function readPaymentStatusFromViewpayInfo(paymentInfo: Record<string, unknown>): {
  paymentStatus: string | undefined;
  rawStatus: unknown;
} {
  const response = paymentInfo?.response as Record<string, unknown> | undefined;
  const raw = response ?? paymentInfo;
  const data = raw?.data as Record<string, unknown> | undefined;
  const rawStatus =
    data?.paymentStatus ??
    raw?.paymentStatus ??
    raw?.payment_status ??
    raw?.status ??
    raw?.payStatus;
  return { paymentStatus: normalizePaymentStatus(rawStatus), rawStatus };
}

function deepFindStringByKey(obj: unknown, keyLower: string): string | undefined {
  if (obj == null || typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const f = deepFindStringByKey(item, keyLower);
      if (f) return f;
    }
    return undefined;
  }
  const o = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (k.toLowerCase() === keyLower && typeof v === "string" && v.trim()) return v.trim();
    const inner = deepFindStringByKey(v, keyLower);
    if (inner) return inner;
  }
  return undefined;
}

/** 응답 JSON 어디에든 있는 cgTid (cgTid / cg_tid 등) */
export function extractCgTidFromViewpayPayload(data: Record<string, unknown>): string | undefined {
  for (const keyLower of ["cgtid", "cg_tid"] as const) {
    const v = deepFindStringByKey(data, keyLower);
    if (v) return v;
  }
  return undefined;
}

export function isViewpayPaymentSucceeded(
  paymentInfo: Record<string, unknown>
): { ok: true } | { ok: false; message: string } {
  const { paymentStatus, rawStatus } = readPaymentStatusFromViewpayInfo(paymentInfo);
  if (!paymentStatus || !PAYMENT_SUCCESS_STATUSES.includes(paymentStatus)) {
    const statusLabel =
      paymentStatus ??
      (typeof rawStatus === "string" ? rawStatus : JSON.stringify(rawStatus ?? "unknown"));
    return {
      ok: false,
      message: `결제가 완료되지 않았습니다. (상태: ${statusLabel})`,
    };
  }
  return { ok: true };
}

/**
 * get-payment-info 성공 판정 후: set-payment-info → orders.paid → 이력·payments → 뉴런 발주
 */
export async function finalizeViewpayOrderPaid(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    orderNo: string;
    totalAmount: number;
    cgTid: string;
  }
): Promise<{ newrun?: { success: boolean; message?: string; skipped?: boolean } }> {
  const { orderId, orderNo, totalAmount, cgTid } = params;
  const amount = Number(totalAmount) || 0;

  const { data: paidRow } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (paidRow?.payment_status === "paid") {
    logger.info(`${LOG} 이미 paid — finalize 생략`, { action: "viewpay_finalize_skip_paid", data: { orderId } });
    return {};
  }

  try {
    logger.info(`${LOG} set-payment-info(STORE_SUCCESS)`, {
      action: "viewpay_finalize_set_info",
      data: { orderId, cgTid, orderNo, amount },
    });
    await viewpayPost("/v1/gw/set-payment-info", {
      cgTid,
      orderId,
      orderNo,
      amount,
      orderStatus: "STORE_SUCCESS",
    });
  } catch (err) {
    if ((err as Error & { response?: { status: number } }).response?.status === 401) {
      clearViewpayTokenCache();
    }
    logger.error(`${LOG} set-payment-info 실패`, {
      action: "viewpay_finalize_set_info_failed",
      data: { orderId, cgTid, error: String((err as Error).message) },
    });
    throw err;
  }

  const { error: updateOrderError, data: orderAfterPay } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      cg_tid: cgTid,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("partner_id")
    .single();

  if (updateOrderError || !orderAfterPay?.partner_id) {
    logger.error(`${LOG} orders 업데이트 실패`, {
      action: "viewpay_finalize_order_update_failed",
      data: { orderId, error: String(updateOrderError?.message ?? "no row") },
    });
    throw new Error("주문 상태 반영에 실패했습니다.");
  }

  await supabase.from("order_status_history").insert({
    order_id: orderId,
    status: "received",
    memo: "결제 완료 (ViewPay)",
  });

  await recordOrderPartnerNotifyEventSafe(supabase, {
    orderId,
    partnerId: orderAfterPay.partner_id,
    kind: "order_paid",
    source: "viewpay_finalize",
    payload: { orderNo, cgTid },
  });

  const { error: paymentInsertError } = await supabase.from("payments").insert({
    order_id: orderId,
    pg_provider: "viewpay",
    pg_txn_id: cgTid,
    amount,
    status: "completed",
    paid_at: new Date().toISOString(),
  });

  if (paymentInsertError) {
    logger.warn(`${LOG} payments INSERT 실패(무시)`, {
      action: "viewpay_finalize_payment_insert_failed",
      data: { orderId, error: String(paymentInsertError.message) },
    });
  }

  let newrun: { success: boolean; message?: string; skipped?: boolean } | undefined;
  try {
    const submitResult = await submitNewrunOrder(supabase, orderId, {
      source: "viewpay_complete",
    });
    if (submitResult.skipped) {
      newrun = { success: true, skipped: true, message: submitResult.message };
    } else if (!submitResult.ok) {
      newrun = { success: false, message: submitResult.message };
      logger.warn(`${LOG} 뉴런 자동 발주 실패`, {
        action: "viewpay_finalize_newrun_failed",
        data: { orderId, message: submitResult.message },
      });
    } else {
      newrun = {
        success: true,
        message: submitResult.duplicate ? submitResult.message : undefined,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "뉴런 발주 처리 오류";
    logger.error(`${LOG} 뉴런 발주 예외`, {
      action: "viewpay_finalize_newrun_error",
      data: { orderId, error: msg },
    });
    newrun = {
      success: false,
      message: "뉴런 자동 발주 중 오류가 발생했습니다. 어드민에서 수동 발주해 주세요.",
    };
  }

  logger.info(`${LOG} 완료`, { action: "viewpay_finalize_success", data: { orderId, orderNo, cgTid } });
  return { ...(newrun ? { newrun } : {}) };
}

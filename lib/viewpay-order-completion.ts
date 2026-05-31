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

/** ViewPay 가맹점(STORE) 이벤트 성공 — webhook 교차 검증용 */
export const VIEWPAY_STORE_SUCCESS_STATUSES = ["STORE_EVENT_SUCCESS", "STORE_SUCCESS"];

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

/** ViewPay 거래 ID 형식 (BOINENS… 등) */
export function looksLikeViewpayTransactionId(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^BOINENS/i.test(v)) return true;
  if (/^BO[A-Z0-9]/i.test(v) && v.length >= 16) return true;
  return false;
}

/** 응답 JSON 어디에든 있는 cgTid / tid */
export function extractCgTidFromViewpayPayload(data: Record<string, unknown>): string | undefined {
  for (const keyLower of ["cgtid", "cg_tid", "tid"] as const) {
    const v = deepFindStringByKey(data, keyLower);
    if (v && looksLikeViewpayTransactionId(v)) return v.trim();
  }
  try {
    const json = JSON.stringify(data);
    const match = json.match(/BOINENS[a-zA-Z0-9]{16,}/);
    if (match?.[0] && looksLikeViewpayTransactionId(match[0])) return match[0];
  } catch {
    // ignore
  }
  return undefined;
}

function deepFindNumberByKey(obj: unknown, keyLower: string): number | undefined {
  if (obj == null || typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const f = deepFindNumberByKey(item, keyLower);
      if (f != null) return f;
    }
    return undefined;
  }
  const o = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (k.toLowerCase() === keyLower) {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
      if (Number.isFinite(n)) return n;
    }
    const inner = deepFindNumberByKey(v, keyLower);
    if (inner != null) return inner;
  }
  return undefined;
}

/** get-payment-info 응답에서 결제 금액 */
export function readAmountFromViewpayInfo(paymentInfo: Record<string, unknown>): number | undefined {
  for (const key of ["amount", "payamount", "totalamount", "approvalamount"] as const) {
    const n = deepFindNumberByKey(paymentInfo, key);
    if (n != null && n >= 0) return n;
  }
  return undefined;
}

/** get-payment-info 응답에서 가맹점 주문번호 (products.orderNo) */
export function extractMerchantOrderNoFromViewpayPayload(
  data: Record<string, unknown>
): string | undefined {
  const products = data?.products as Record<string, unknown> | undefined;
  const response = data?.response as Record<string, unknown> | undefined;
  const responseProducts = response?.products as Record<string, unknown> | undefined;
  const responseData = response?.data as Record<string, unknown> | undefined;
  const dataProducts = responseData?.products as Record<string, unknown> | undefined;
  for (const candidate of [
    products?.orderNo,
    responseProducts?.orderNo,
    dataProducts?.orderNo,
    deepFindStringByKey(data, "orderno"),
  ]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

/** prepare metaData `{ o: orderId }` 등에서 CallLink orders.id */
export function extractOrderIdFromViewpayPayload(data: Record<string, unknown>): string | undefined {
  for (const raw of [
    data?.metaData,
    data?.metadata,
    (data?.response as Record<string, unknown> | undefined)?.metaData,
    deepFindStringByKey(data, "metadata"),
  ]) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    try {
      const parsed = JSON.parse(raw) as { o?: string; orderId?: string };
      const id = parsed?.o ?? parsed?.orderId;
      if (typeof id === "string" && id.trim()) return id.trim();
    } catch {
      // ignore
    }
  }
  const direct = deepFindStringByKey(data, "orderid");
  if (direct && /^[0-9a-f-]{36}$/i.test(direct)) return direct;
  return undefined;
}

/** STORE_EVENT_SUCCESS 등 가맹점 이벤트 상태 */
export function readStoreOrderStatusFromViewpayInfo(
  paymentInfo: Record<string, unknown>
): string | undefined {
  const response = paymentInfo?.response as Record<string, unknown> | undefined;
  const raw = response ?? paymentInfo;
  const data = raw?.data as Record<string, unknown> | undefined;
  const candidates = [
    data?.orderStatus,
    data?.storeStatus,
    data?.storeEventStatus,
    raw?.orderStatus,
    raw?.storeStatus,
    deepFindStringByKey(paymentInfo, "orderstatus"),
  ];
  for (const c of candidates) {
    const s = normalizePaymentStatus(c);
    if (s) return s;
  }
  return undefined;
}

export function amountsMatchViewpayOrder(expected: number, pgAmount: number): boolean {
  const a = Number(expected);
  const b = Number(pgAmount);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) < 0.01;
}

/**
 * webhook·sync 교차 검증: PG/STORE 승인 상태 + 주문 금액 일치
 */
export function verifyViewpayPaymentAgainstOrder(
  paymentInfo: Record<string, unknown>,
  expectedAmount: number
): { ok: true } | { ok: false; message: string } {
  const payOk = isViewpayPaymentSucceeded(paymentInfo);
  const storeStatus = readStoreOrderStatusFromViewpayInfo(paymentInfo);
  const storeOk =
    typeof storeStatus === "string" && VIEWPAY_STORE_SUCCESS_STATUSES.includes(storeStatus);

  if (!payOk.ok && !storeOk) {
    const { paymentStatus, rawStatus } = readPaymentStatusFromViewpayInfo(paymentInfo);
    const statusLabel =
      storeStatus ??
      paymentStatus ??
      (typeof rawStatus === "string" ? rawStatus : JSON.stringify(rawStatus ?? "unknown"));
    return {
      ok: false,
      message: `결제 승인 상태가 확인되지 않습니다. (상태: ${statusLabel})`,
    };
  }

  const pgAmount = readAmountFromViewpayInfo(paymentInfo);
  if (pgAmount == null) {
    return { ok: false, message: "결제 조회 응답에서 금액을 확인할 수 없습니다." };
  }
  if (!amountsMatchViewpayOrder(expectedAmount, pgAmount)) {
    return {
      ok: false,
      message: `결제 금액이 주문과 일치하지 않습니다. (주문: ${expectedAmount}, PG: ${pgAmount})`,
    };
  }

  return { ok: true };
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

  const { data: preRow } = await supabase
    .from("orders")
    .select("payment_status, checkout_cart_item_ids")
    .eq("id", orderId)
    .maybeSingle();
  if (preRow?.payment_status === "paid") {
    logger.info(`${LOG} 이미 paid — finalize 생략`, { action: "viewpay_finalize_skip_paid", data: { orderId } });
    return {};
  }

  const reservedCartIds =
    Array.isArray(preRow?.checkout_cart_item_ids) && preRow.checkout_cart_item_ids.length > 0
      ? (preRow.checkout_cart_item_ids as unknown[])
          .map((id) => String(id).trim())
          .filter(Boolean)
      : [];

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

  if (reservedCartIds.length > 0) {
    const { error: cartDelErr } = await supabase.from("cart_items").delete().in("id", reservedCartIds);
    if (cartDelErr) {
      logger.warn(`${LOG} 결제 완료 후 장바구니 삭제 실패(무시)`, {
        action: "viewpay_finalize_cart_delete_failed",
        data: { orderId, error: String(cartDelErr.message) },
      });
    }
    const { error: reserveClearErr } = await supabase
      .from("orders")
      .update({
        checkout_cart_item_ids: null,
        guest_cart_session_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    if (reserveClearErr) {
      logger.warn(`${LOG} 주문 예약 카트 필드 클리어 실패(무시)`, {
        action: "viewpay_finalize_reserve_clear_failed",
        data: { orderId, error: String(reserveClearErr.message) },
      });
    }
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

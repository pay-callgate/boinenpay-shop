/**
 * ViewPay 전액 취소 — https://boinenpay.com/docs/cancel-payment-api.html
 * 결제 시점에 등록된 orderNo는 DB와 다를 수 있어, 취소 전 get-payment-info로 확정한다.
 */

import { getViewPayEnv, viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";
import { logger } from "@/lib/logger";
import { readPaymentStatusFromViewpayInfo } from "@/lib/viewpay-order-completion";

const LOG = "[ViewPay:CancelPayment]";

export type ViewpayFullCancelParams = {
  cgTid: string;
  /** PG 조회 실패 시에만 사용하는 예비 주문번호 */
  orderNoFallback?: string;
  reason: string;
};

function isCancelSuccess(data: Record<string, unknown>): boolean {
  const status = data?.status as { code?: string } | undefined;
  const result = data?.result as { code?: string } | undefined;
  const code = String(status?.code ?? result?.code ?? data?.code ?? "").trim();
  return code === "0000";
}

function readCancelError(data: Record<string, unknown>): { code: string; message: string } {
  const status = data?.status as { code?: string; message?: string } | undefined;
  const result = data?.result as { code?: string; message?: string } | undefined;
  const code = String(status?.code ?? result?.code ?? data?.code ?? "").trim();
  const message = String(
    status?.message ?? result?.message ?? data?.message ?? "결제 취소에 실패했습니다."
  ).trim();
  return { code, message };
}

type PaymentInfoSnap = {
  queryOk: boolean;
  statusCode: string;
  statusMessage: string;
  orderNo: string | null;
  paymentStatus: string | null;
};

async function fetchViewpayPaymentInfoSnap(cgTid: string): Promise<PaymentInfoSnap> {
  let raw: Record<string, unknown>;
  try {
    raw = await viewpayPost("/v1/gw/get-payment-info", { cgTid: String(cgTid).trim() });
  } catch (e) {
    if ((e as Error & { response?: { status: number } }).response?.status === 401) {
      clearViewpayTokenCache();
    }
    throw e;
  }

  const status = raw?.status as { code?: string; message?: string } | undefined;
  const topResult = raw?.result as { code?: string; message?: string } | undefined;
  const statusCode = String(status?.code ?? topResult?.code ?? "").trim();
  const statusMessage = String(status?.message ?? topResult?.message ?? "").trim();
  const response = raw?.response as Record<string, unknown> | undefined;
  const base = response ?? raw;
  const data = base?.data as Record<string, unknown> | undefined;
  const orderNoRaw = data?.orderNo ?? data?.order_no;
  const orderNo =
    typeof orderNoRaw === "string" && orderNoRaw.trim() ? orderNoRaw.trim() : null;
  const { paymentStatus } = readPaymentStatusFromViewpayInfo(raw);

  return {
    queryOk: statusCode === "0000",
    statusCode,
    statusMessage,
    orderNo,
    paymentStatus: paymentStatus ?? null,
  };
}

/**
 * POST /v1/gw/cancel-payment (전액 취소)
 * @returns ViewPay 응답 본문(원문)
 */
export async function viewpayCancelFullPayment(
  params: ViewpayFullCancelParams
): Promise<Record<string, unknown>> {
  const { channelId, merchantId } = getViewPayEnv();
  if (!channelId || !merchantId) {
    throw new Error("ViewPay 채널/가맹점 ID 미설정(VIEWPAY_CHANNEL_ID, VIEWPAY_MERCHANT_ID).");
  }

  const cgTid = String(params.cgTid).trim();
  const reason = String(params.reason ?? "").trim() || "고객 요청에 의한 취소";

  const snap = await fetchViewpayPaymentInfoSnap(cgTid);
  if (!snap.queryOk) {
    throw new Error(
      `[${snap.statusCode || "조회실패"}] ${snap.statusMessage || "결제 정보 조회에 실패했습니다."}`
    );
  }

  if (
    snap.paymentStatus === "PG_CANCEL_SUCCESS" ||
    snap.paymentStatus === "PG_PART_CANCEL_SUCCESS"
  ) {
    logger.info(`${LOG} PG에서 이미 취소된 건 — cancel-payment 생략`, {
      action: "viewpay_cancel_skip_already_pg_cancelled",
      data: { cgTidPreview: cgTid.slice(0, 12), paymentStatus: snap.paymentStatus },
    });
    return {
      status: { code: "0000", message: "이미 취소된 결제(조회 기준)" },
      skippedCancelPayment: true,
      paymentStatus: snap.paymentStatus,
    };
  }

  const orderNo =
    snap.orderNo?.trim() || String(params.orderNoFallback ?? "").trim();
  if (!orderNo) {
    throw new Error(
      "ViewPay에 등록된 주문번호(orderNo)를 확인할 수 없습니다. 결제 연동을 점검해 주세요."
    );
  }

  logger.info(`${LOG} 취소에 사용할 orderNo`, {
    action: "viewpay_cancel_order_no_resolved",
    data: {
      orderNoFromPg: Boolean(snap.orderNo),
      cgTidPreview: cgTid.slice(0, 12),
    },
  });

  const body = {
    cancelInfo: {
      cgTid,
      orderNo,
      channelId,
      storeId: merchantId,
      reason,
    },
  };

  logger.info(`${LOG} cancel-payment 요청`, {
    action: "viewpay_cancel_payment_request",
    data: { orderNo: body.cancelInfo.orderNo, cgTidPreview: cgTid.slice(0, 12) },
  });

  try {
    const res = await viewpayPost("/v1/gw/cancel-payment", body);
    if (!isCancelSuccess(res)) {
      const { code, message } = readCancelError(res);
      throw new Error(`[${code}] ${message}`);
    }
    logger.info(`${LOG} 성공`, {
      action: "viewpay_cancel_payment_success",
      data: { orderNo: body.cancelInfo.orderNo },
    });
    return res;
  } catch (e) {
    if ((e as Error & { response?: { status: number } }).response?.status === 401) {
      clearViewpayTokenCache();
    }
    throw e;
  }
}

/**
 * ViewPay 전액 취소 — https://boinenpay.com/docs/cancel-payment-api.html
 */

import { getViewPayEnv, viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";
import { logger } from "@/lib/logger";

const LOG = "[ViewPay:CancelPayment]";

export type ViewpayFullCancelParams = {
  cgTid: string;
  /** 가맹점 주문번호 — prepare 시 저장한 viewpay_merchant_order_no 권장 */
  orderNo: string;
  reason: string;
};

function isCancelSuccess(data: Record<string, unknown>): boolean {
  const status = data?.status as { code?: string } | undefined;
  const code = status?.code ?? (data?.code as string | undefined);
  return String(code ?? "").trim() === "0000";
}

/**
 * POST /v1/gw/cancel-payment (전체 취소)
 * @returns ViewPay 응답 본문(원문)
 */
export async function viewpayCancelFullPayment(
  params: ViewpayFullCancelParams
): Promise<Record<string, unknown>> {
  const { channelId, merchantId } = getViewPayEnv();
  if (!channelId || !merchantId) {
    throw new Error("ViewPay 채널/가맹점 ID 미설정(VIEWPAY_CHANNEL_ID, VIEWPAY_MERCHANT_ID).");
  }

  const reason = String(params.reason ?? "").trim() || "고객 요청에 의한 취소";
  const body = {
    cancelInfo: {
      cgTid: String(params.cgTid).trim(),
      orderNo: String(params.orderNo).trim(),
      channelId,
      storeId: merchantId,
      reason,
    },
  };

  logger.info(`${LOG} 요청`, {
    action: "viewpay_cancel_payment_request",
    data: { orderNo: body.cancelInfo.orderNo, cgTidPreview: body.cancelInfo.cgTid.slice(0, 12) },
  });

  try {
    const res = await viewpayPost("/v1/gw/cancel-payment", body);
    if (!isCancelSuccess(res)) {
      const status = res?.status as { code?: string; message?: string } | undefined;
      const msg = status?.message ?? (res?.message as string) ?? "결제 취소에 실패했습니다.";
      const code = status?.code ?? "";
      throw new Error(`[${code}] ${msg}`);
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

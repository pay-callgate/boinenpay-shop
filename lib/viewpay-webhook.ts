import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import { syncViewpayOrderPayment } from "@/lib/viewpay-payment-sync";

const LOG = "[ViewPay:Webhook]";

export type ViewpayWebhookResponse = {
  result: string;
  resultMessage: string;
};

export function viewpayWebhookSuccess(): ViewpayWebhookResponse {
  return { result: "0000", resultMessage: "success" };
}

export function viewpayWebhookFailure(
  result: string,
  resultMessage: string
): ViewpayWebhookResponse {
  return { result, resultMessage };
}

/**
 * ViewPay webhook 본문 `{ cgTid }` 처리.
 * DB 직접 갱신 없이 get-payment-info 교차 검증 후 sync 모듈로 finalize.
 */
export async function handleViewpayWebhook(cgTid: string): Promise<ViewpayWebhookResponse> {
  const trimmed = cgTid.trim();
  if (!trimmed) {
    return viewpayWebhookFailure("1001", "cgTid is required");
  }

  logger.info(`${LOG} 수신`, {
    action: "viewpay_webhook_received",
    data: { cgTid: trimmed },
  });

  const supabase = createServerSupabase();
  const syncResult = await syncViewpayOrderPayment(supabase, {
    cgTid: trimmed,
    source: "webhook",
  });

  if (syncResult.ok) {
    logger.info(`${LOG} 처리 완료`, {
      action: syncResult.alreadyPaid
        ? "viewpay_webhook_idempotent"
        : "viewpay_webhook_success",
      data: {
        orderId: syncResult.orderId,
        orderNo: syncResult.orderNo,
        cgTid: syncResult.cgTid,
      },
    });
    return viewpayWebhookSuccess();
  }

  const action = syncResult.action;
  logger.warn(`${LOG} 처리 실패`, {
    action,
    data: { cgTid: trimmed, message: syncResult.message },
  });

  if (action === "viewpay_payment_sync_order_not_found") {
    return viewpayWebhookFailure("1003", syncResult.message);
  }
  if (action === "viewpay_payment_sync_get_info_failed") {
    return viewpayWebhookFailure("1002", syncResult.message);
  }
  if (
    action === "viewpay_payment_sync_verify_failed" ||
    action === "viewpay_payment_sync_no_cgtid"
  ) {
    return viewpayWebhookFailure("1004", syncResult.message);
  }

  return viewpayWebhookFailure("9999", syncResult.message);
}

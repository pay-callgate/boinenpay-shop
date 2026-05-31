import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { handleViewpayWebhook } from "@/lib/viewpay-webhook";

export const dynamic = "force-dynamic";

/**
 * ViewPay 결제 승인 webhook (S2S)
 * POST /api/payment/viewpay/webhook
 * Body: { "cgTid": "BOINENS..." }
 *
 * cgTid만 수신 — get-payment-info 교차 검증 후 DB paid 반영 (lib/viewpay-payment-sync)
 * 응답: { "result": "0000", "resultMessage": "success" }
 */
const LOG = "[ViewPay:WebhookRoute]";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { cgTid?: unknown };
    const cgTid = typeof body.cgTid === "string" ? body.cgTid.trim() : "";

    if (!cgTid) {
      logger.warn(`${LOG} cgTid 누락`, { action: "viewpay_webhook_bad_request" });
      return NextResponse.json(
        { result: "1001", resultMessage: "cgTid is required" },
        { status: 200 }
      );
    }

    const response = await handleViewpayWebhook(cgTid);
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    logger.error(`${LOG} error`, {
      action: "viewpay_webhook_error",
      data: { error: String((err as Error).message) },
    });
    return NextResponse.json(
      { result: "9999", resultMessage: "internal error" },
      { status: 200 }
    );
  }
}

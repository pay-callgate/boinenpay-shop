import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";

/**
 * Phase B5: 결제 취소 (ViewPay cancel-payment, 전체/부분)
 * POST /api/payment/viewpay/cancel
 * Body: { cgTid, orderId?, cancelAmount? } — cancelAmount 생략 시 전체 취소
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { cgTid, orderId, cancelAmount } = body;

    logger.info("[ViewPay cancel] 요청", { action: "payment_viewpay_cancel_request", data: { cgTid, orderId, cancelAmount } });

    if (!cgTid?.trim()) {
      logger.warn("[ViewPay cancel] cgTid 누락", { action: "payment_viewpay_cancel_bad_request" });
      return NextResponse.json(
        { success: false, message: "cgTid 필수입니다." },
        { status: 400 }
      );
    }

    const postBody: Record<string, string | number> = {
      cgTid: String(cgTid).trim(),
    };
    if (orderId?.trim()) postBody.orderId = String(orderId).trim();
    if (cancelAmount != null) postBody.cancelAmount = Number(cancelAmount);

    const result = await viewpayPost("/v1/gw/cancel-payment", postBody);
    logger.info("[ViewPay cancel] 성공", { action: "payment_viewpay_cancel_success", data: { cgTid, orderId } });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if ((err as Error & { response?: { status: number } }).response?.status === 401) {
      clearViewpayTokenCache();
    }
    logger.error("[ViewPay cancel] error", { action: "payment_viewpay_cancel_error", data: { error: String((err as Error).message) } });
    const message = (err as Error).message || "결제 취소에 실패했습니다.";
    return NextResponse.json(
      { success: false, message },
      { status: (err as Error & { response?: { status: number } }).response?.status ?? 500 }
    );
  }
}

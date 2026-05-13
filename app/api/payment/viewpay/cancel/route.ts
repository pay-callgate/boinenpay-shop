import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { clearViewpayTokenCache } from "@/lib/viewpay";
import { viewpayCancelFullPayment } from "@/lib/viewpay-cancel-payment";

/**
 * Phase B5: ViewPay 전액 취소 (공식 cancelInfo 형식)
 * POST /api/payment/viewpay/cancel
 * Body: { cgTid, orderNo, reason? } — 주문 취소 플로우는 POST /api/orders/[id]/cancel 권장
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { cgTid, orderNo, reason } = body;

    logger.info("[ViewPay cancel] 요청", {
      action: "payment_viewpay_cancel_request",
      data: {
        hasCgTid: Boolean(cgTid?.trim()),
        hasOrderNo: Boolean(orderNo?.trim()),
      },
    });

    if (!cgTid?.trim()) {
      logger.warn("[ViewPay cancel] cgTid 누락", { action: "payment_viewpay_cancel_bad_request" });
      return NextResponse.json(
        { success: false, message: "cgTid 필수입니다." },
        { status: 400 }
      );
    }
    if (!orderNo?.trim()) {
      return NextResponse.json(
        { success: false, message: "orderNo(가맹점 주문번호) 필수입니다." },
        { status: 400 }
      );
    }

    const result = await viewpayCancelFullPayment({
      cgTid: String(cgTid).trim(),
      orderNo: String(orderNo).trim(),
      reason:
        typeof reason === "string" && reason.trim()
          ? reason.trim()
          : "운영자/테스트 전액 취소",
    });
    logger.info("[ViewPay cancel] 성공", {
      action: "payment_viewpay_cancel_success",
      data: { orderNo: String(orderNo).trim() },
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if ((err as Error & { response?: { status: number } }).response?.status === 401) {
      clearViewpayTokenCache();
    }
    logger.error("[ViewPay cancel] error", {
      action: "payment_viewpay_cancel_error",
      data: { error: String((err as Error).message) },
    });
    const message = (err as Error).message || "결제 취소에 실패했습니다.";
    return NextResponse.json(
      { success: false, message },
      { status: (err as Error & { response?: { status: number } }).response?.status ?? 500 }
    );
  }
}

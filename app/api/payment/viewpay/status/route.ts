import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";

/**
 * Phase B4: 주문 상태 업데이트 (ViewPay set-payment-info)
 * POST /api/payment/viewpay/status
 * Body: { cgTid, orderId?, orderStatus } — orderStatus: STORE_SUCCESS | STORE_PENDING | STORE_FAIL
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { cgTid, orderId, orderStatus } = body;

    logger.info("[ViewPay status] 요청", { action: "payment_viewpay_status_request", data: { cgTid, orderId, orderStatus } });

    if (!cgTid?.trim() || !orderStatus?.trim()) {
      logger.warn("[ViewPay status] 파라미터 누락", { action: "payment_viewpay_status_bad_request", data: { cgTid, orderStatus } });
      return NextResponse.json(
        { success: false, message: "cgTid, orderStatus 필수입니다." },
        { status: 400 }
      );
    }

    const validStatuses = ["STORE_SUCCESS", "STORE_PENDING", "STORE_FAIL"];
    if (!validStatuses.includes(String(orderStatus).trim())) {
      logger.warn("[ViewPay status] 잘못된 orderStatus", { action: "payment_viewpay_status_invalid_status", data: { orderStatus } });
      return NextResponse.json(
        { success: false, message: "orderStatus는 STORE_SUCCESS, STORE_PENDING, STORE_FAIL 중 하나여야 합니다." },
        { status: 400 }
      );
    }

    const result = await viewpayPost("/v1/gw/set-payment-info", {
      cgTid: String(cgTid).trim(),
      ...(orderId?.trim() ? { orderId: String(orderId).trim() } : {}),
      orderStatus: String(orderStatus).trim(),
    });
    logger.info("[ViewPay status] 성공", { action: "payment_viewpay_status_success", data: { cgTid, orderId, orderStatus } });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if ((err as Error & { response?: { status: number } }).response?.status === 401) {
      clearViewpayTokenCache();
    }
    logger.error("[ViewPay status] error", { action: "payment_viewpay_status_error", data: { error: String((err as Error).message) } });
    const message = (err as Error).message || "주문 상태 업데이트에 실패했습니다.";
    return NextResponse.json(
      { success: false, message },
      { status: (err as Error & { response?: { status: number } }).response?.status ?? 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

    if (!cgTid?.trim() || !orderStatus?.trim()) {
      return NextResponse.json(
        { success: false, message: "cgTid, orderStatus 필수입니다." },
        { status: 400 }
      );
    }

    const validStatuses = ["STORE_SUCCESS", "STORE_PENDING", "STORE_FAIL"];
    if (!validStatuses.includes(String(orderStatus).trim())) {
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
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if ((err as Error & { response?: { status: number } }).response?.status === 401) {
      clearViewpayTokenCache();
    }
    console.error("[ViewPay status] error:", err);
    const message = (err as Error).message || "주문 상태 업데이트에 실패했습니다.";
    return NextResponse.json(
      { success: false, message },
      { status: (err as Error & { response?: { status: number } }).response?.status ?? 500 }
    );
  }
}

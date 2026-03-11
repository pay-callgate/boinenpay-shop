import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

    if (!cgTid?.trim()) {
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
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if ((err as Error & { response?: { status: number } }).response?.status === 401) {
      clearViewpayTokenCache();
    }
    console.error("[ViewPay cancel] error:", err);
    const message = (err as Error).message || "결제 취소에 실패했습니다.";
    return NextResponse.json(
      { success: false, message },
      { status: (err as Error & { response?: { status: number } }).response?.status ?? 500 }
    );
  }
}

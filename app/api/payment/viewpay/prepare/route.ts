import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildStartpayBody,
  viewpayPost,
  isStartpaySuccess,
  getRedirectUrlFromStartpayResponse,
  clearViewpayTokenCache,
} from "@/lib/viewpay";

/**
 * Phase B1: 결제 준비 (ViewPay startpay 호출 → 결제창 URL 반환)
 * POST /api/payment/viewpay/prepare
 * Body: orderId, orderNo, amount, buyerName, buyerPhone, buyerEmail, returnUrl, cancelUrl?, productName?, taxfreeAmount?, taxAmount?
 */
const LOG = "[Order:Prepare]";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    console.debug(LOG, "요청 수신", { bodyKeys: Object.keys(body as object) });
    const {
      orderId,
      orderNo,
      amount,
      taxfreeAmount = 0,
      taxAmount = 0,
      productName,
      returnUrl,
      cancelUrl,
      buyerName,
      buyerPhone,
      buyerEmail,
    } = body;

    if (!orderId || amount == null || !returnUrl) {
      return NextResponse.json(
        { success: false, message: "orderId, amount, returnUrl 필수입니다." },
        { status: 400 }
      );
    }

    if (!buyerName?.trim() || !buyerPhone?.trim() || !buyerEmail?.trim()) {
      return NextResponse.json(
        { success: false, message: "주문자 정보(이름, 연락처, 이메일)가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, order_no, total_amount, payment_status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (order.user_id !== session.user.id) {
      return NextResponse.json(
        { success: false, message: "해당 주문에 대한 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (order.payment_status === "paid") {
      return NextResponse.json(
        { success: false, message: "이미 결제 완료된 주문입니다." },
        { status: 400 }
      );
    }

    // 테스트용: startpay 실패(9097) 시뮬레이션. .env.local에 VIEWPAY_SIMULATE_STARTPAY_ERROR=9097 설정 시 실제 startpay 호출 없이 400 반환.
    const simulateError = process.env.VIEWPAY_SIMULATE_STARTPAY_ERROR;
    if (simulateError === "9097") {
      console.debug(LOG, "시뮬레이션 9097 반환 (실제 startpay 미호출)");
      return NextResponse.json(
        { success: false, message: "[9097] 기간 입니다" },
        { status: 400 }
      );
    }

    const orderNoVal = orderNo ?? order.order_no ?? orderId;
    const startpayBody = buildStartpayBody({
      orderId,
      orderNo: String(orderNoVal),
      amount: Number(amount),
      taxfreeAmount: Number(taxfreeAmount),
      taxAmount: Number(taxAmount),
      productName: productName?.trim() || "주문상품",
      returnUrl,
      cancelUrl,
      buyerName: String(buyerName).trim(),
      buyerPhone: String(buyerPhone).trim(),
      buyerEmail: String(buyerEmail).trim(),
    });

    console.debug(LOG, "startpay 호출", {
      orderId,
      orderNo: orderNoVal,
      amount: Number(amount),
      returnUrl: returnUrl ? `${String(returnUrl).slice(0, 60)}...` : undefined,
    });

    let data: Record<string, unknown>;
    try {
      data = await viewpayPost("/v1/gw/startpay", startpayBody);
      console.debug(LOG, "startpay 응답 수신", { success: isStartpaySuccess(data) });
    } catch (err) {
      console.debug(LOG, "startpay 실패", err);
      const message = (err as Error & { response?: { status: number; data?: unknown } }).response?.data as
        | { result?: { message?: string }; message?: string }
        | undefined;
      const msg =
        message?.result?.message ?? message?.message ?? (err as Error).message;
      if ((err as Error & { response?: { status: number } }).response?.status === 401) {
        clearViewpayTokenCache();
      }
      return NextResponse.json(
        { success: false, message: msg || "결제 요청에 실패했습니다." },
        { status: 400 }
      );
    }

    if (!isStartpaySuccess(data)) {
      const result = data?.result as { code?: string; message?: string } | undefined;
      const code = result?.code ?? (data?.code as string);
      const msg = result?.message ?? (data?.message as string) ?? "결제 요청이 거절되었습니다.";
      console.debug(LOG, "startpay result.code 실패", { code, message: msg });
      return NextResponse.json(
        { success: false, message: `[${code}] ${msg}`.trim() },
        { status: 400 }
      );
    }

    const redirectUrl = getRedirectUrlFromStartpayResponse(data);
    console.debug(LOG, "redirectUrl 생성", { hasRedirectUrl: Boolean(redirectUrl) });
    if (!redirectUrl) {
      return NextResponse.json(
        { success: false, message: "결제창 URL을 받지 못했습니다." },
        { status: 400 }
      );
    }

    console.debug(LOG, "성공", { orderId, redirectUrlPreview: redirectUrl?.slice(0, 80) });
    return NextResponse.json({ success: true, redirectUrl });
  } catch (err) {
    console.error(LOG, "error:", err);
    return NextResponse.json(
      { success: false, message: (err as Error).message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

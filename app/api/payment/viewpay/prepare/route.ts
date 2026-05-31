import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildStartpayBody,
  buildMerchantViewpayOrderNo,
  viewpayPost,
  isStartpaySuccess,
  getRedirectUrlFromStartpayResponse,
  isViewpayGatewayRedirectUrl,
  clearViewpayTokenCache,
  resolveViewpayWebhookUrl,
} from "@/lib/viewpay";
import { verifyGuestCheckout } from "@/lib/guest-checkout-signature";

/**
 * Phase B1: 결제 준비 (ViewPay startpay 호출 → 결제창 URL 반환)
 * POST /api/payment/viewpay/prepare
 * Body: orderId, orderNo, amount, buyerName, buyerPhone, buyerEmail, returnUrl, cancelUrl?, productName?, taxfreeAmount?, taxAmount?
 */
const LOG = "[Order:Prepare]";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const body = await request.json().catch(() => ({}));
    logger.info(`${LOG} 요청 수신`, { action: "payment_viewpay_prepare_request", data: { bodyKeys: Object.keys(body as object) } });
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
      guestCheckoutToken,
      paymentSignature,
    } = body;

    if (!orderId || amount == null || !returnUrl) {
      logger.warn(`${LOG} 파라미터 누락`, { action: "payment_viewpay_prepare_bad_request", data: { hasOrderId: !!orderId, hasAmount: amount != null, hasReturnUrl: !!returnUrl } });
      return NextResponse.json(
        { success: false, message: "orderId, amount, returnUrl 필수입니다." },
        { status: 400 }
      );
    }

    if (!buyerName?.trim() || !buyerPhone?.trim()) {
      logger.warn(`${LOG} 주문자 정보 누락`, { action: "payment_viewpay_prepare_buyer_missing", data: { orderId } });
      return NextResponse.json(
        { success: false, message: "주문자 정보(이름, 연락처)가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, user_id, order_no, total_amount, payment_status, is_guest, guest_checkout_token"
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      logger.warn(`${LOG} 주문 없음`, { action: "payment_viewpay_prepare_order_not_found", data: { orderId } });
      return NextResponse.json(
        { success: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (session?.user?.id) {
      if (order.user_id !== session.user.id) {
        logger.warn(`${LOG} 권한 없음`, { action: "payment_viewpay_prepare_forbidden", data: { orderId } });
        return NextResponse.json(
          { success: false, message: "해당 주문에 대한 권한이 없습니다." },
          { status: 403 }
        );
      }
    } else {
      const okGuest =
        order.is_guest &&
        order.guest_checkout_token &&
        typeof guestCheckoutToken === "string" &&
        typeof paymentSignature === "string" &&
        order.guest_checkout_token === guestCheckoutToken &&
        verifyGuestCheckout(orderId, guestCheckoutToken, paymentSignature);
      if (!okGuest) {
        logger.warn(`${LOG} 비회원 인증 실패`, { action: "payment_viewpay_prepare_guest_auth_failed", data: { orderId } });
        return NextResponse.json(
          { success: false, message: "로그인이 필요하거나 비회원 결제 인증이 올바르지 않습니다." },
          { status: 401 }
        );
      }
    }

    if (order.payment_status === "paid") {
      logger.warn(`${LOG} 이미 결제완료`, { action: "payment_viewpay_prepare_already_paid", data: { orderId } });
      return NextResponse.json(
        { success: false, message: "이미 결제 완료된 주문입니다." },
        { status: 400 }
      );
    }

    // 테스트용: startpay 실패(9097) 시뮬레이션. .env.local에 VIEWPAY_SIMULATE_STARTPAY_ERROR=9097 설정 시 실제 startpay 호출 없이 400 반환.
    const simulateError = process.env.VIEWPAY_SIMULATE_STARTPAY_ERROR;
    if (simulateError === "9097") {
      logger.info(`${LOG} 시뮬레이션 9097 반환 (실제 startpay 미호출)`, { action: "payment_viewpay_prepare_simulate_9097", data: { orderId } });
      return NextResponse.json(
        { success: false, message: "[9097] 기간 입니다" },
        { status: 400 }
      );
    }

    const orderNoVal = orderNo ?? order.order_no ?? orderId;
    const merchantOrderNo = buildMerchantViewpayOrderNo(String(orderNoVal));
    const metaData = JSON.stringify({ o: orderId });

    const { error: merchantNoErr } = await supabase
      .from("orders")
      .update({
        viewpay_merchant_order_no: merchantOrderNo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (merchantNoErr) {
      logger.warn(`${LOG} viewpay_merchant_order_no 저장 실패(계속)`, {
        action: "payment_viewpay_prepare_merchant_no_warn",
        data: { orderId, error: String(merchantNoErr.message) },
      });
    }

    const webhookUrl = resolveViewpayWebhookUrl();
    if (!webhookUrl) {
      logger.warn(`${LOG} webhookUrl 미설정`, {
        action: "payment_viewpay_prepare_webhook_missing",
        data: { orderId },
      });
    }

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
      buyerEmail: typeof buyerEmail === "string" ? buyerEmail.trim() : "",
      merchantOrderNo,
      metaData,
    });

    logger.info(`${LOG} startpay 호출`, {
      action: "payment_viewpay_prepare_startpay",
      data: {
        orderId,
        orderNo: orderNoVal,
        amount: Number(amount),
        returnUrlPreview: returnUrl ? `${String(returnUrl).slice(0, 60)}...` : undefined,
        webhookUrlPreview: webhookUrl ? `${webhookUrl.slice(0, 80)}...` : "(empty)",
        hasWebhookUrl: Boolean(webhookUrl),
      },
    });

    let data: Record<string, unknown>;
    try {
      data = await viewpayPost("/v1/gw/startpay", startpayBody);
      logger.info(`${LOG} startpay 응답 수신`, { action: "payment_viewpay_prepare_startpay_response", data: { orderId, success: isStartpaySuccess(data) } });
    } catch (err) {
      logger.error(`${LOG} startpay 실패`, { action: "payment_viewpay_prepare_startpay_failed", data: { orderId, error: String((err as Error).message) } });
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
      logger.warn(`${LOG} startpay result.code 실패`, { action: "payment_viewpay_prepare_startpay_rejected", data: { orderId, code, message: msg } });
      return NextResponse.json(
        { success: false, message: `[${code}] ${msg}`.trim() },
        { status: 400 }
      );
    }

    const redirectUrl = getRedirectUrlFromStartpayResponse(data);
    logger.info(`${LOG} redirectUrl 생성`, { action: "payment_viewpay_prepare_redirect", data: { orderId, hasRedirectUrl: Boolean(redirectUrl) } });
    if (!redirectUrl) {
      logger.warn(`${LOG} redirectUrl 없음`, { action: "payment_viewpay_prepare_no_redirect", data: { orderId } });
      return NextResponse.json(
        { success: false, message: "결제창 URL을 받지 못했습니다." },
        { status: 400 }
      );
    }

    if (!isViewpayGatewayRedirectUrl(redirectUrl)) {
      logger.warn(`${LOG} PG URL 아님`, {
        action: "payment_viewpay_prepare_invalid_redirect",
        data: { orderId, redirectUrlPreview: redirectUrl.slice(0, 120) },
      });
      return NextResponse.json(
        {
          success: false,
          message: "결제창 URL 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: 400 }
      );
    }

    logger.info(`${LOG} 성공`, { action: "payment_viewpay_prepare_success", data: { orderId, redirectUrlPreview: redirectUrl?.slice(0, 80) } });
    return NextResponse.json({ success: true, redirectUrl });
  } catch (err) {
    logger.error(`${LOG} error`, { action: "payment_viewpay_prepare_error", data: { error: String((err as Error).message) } });
    return NextResponse.json(
      { success: false, message: (err as Error).message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

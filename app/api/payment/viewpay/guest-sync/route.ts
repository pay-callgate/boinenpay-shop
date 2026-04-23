import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import { viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";
import { verifyGuestCheckout } from "@/lib/guest-checkout-signature";
import {
  extractCgTidFromViewpayPayload,
  finalizeViewpayOrderPaid,
  isViewpayPaymentSucceeded,
} from "@/lib/viewpay-order-completion";

const LOG = "[Order:ViewPayGuestSync]";

/**
 * ViewPay가 returnUrl에 cgTid를 붙이지 않은 경우(운영 이슈) 비회원 주문만 서버에서 보정.
 * prepare 시 저장한 viewpay_merchant_order_no 로 get-payment-info 를 시도한다.
 * (ViewPay 규격에 orderNo 조회가 없으면 실패할 수 있음 → 웹훅/가맹점 측 URL 설정 필요)
 *
 * POST /api/payment/viewpay/guest-sync
 * Body: { orderId, guestToken, paymentSignature }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const guestToken =
      typeof body.guestToken === "string"
        ? body.guestToken.trim()
        : typeof body.guestCheckoutToken === "string"
          ? body.guestCheckoutToken.trim()
          : "";
    const paymentSignature =
      typeof body.paymentSignature === "string"
        ? body.paymentSignature.trim()
        : typeof body.sig === "string"
          ? body.sig.trim()
          : "";

    if (!orderId || !guestToken || !paymentSignature) {
      return NextResponse.json(
        { success: false, message: "orderId, guestToken, paymentSignature(또는 sig)가 필요합니다." },
        { status: 400 }
      );
    }

    if (!verifyGuestCheckout(orderId, guestToken, paymentSignature)) {
      logger.warn(`${LOG} 서명 불일치`, { action: "viewpay_guest_sync_sig_bad", data: { orderId } });
      return NextResponse.json({ success: false, message: "비회원 결제 인증이 올바르지 않습니다." }, { status: 401 });
    }

    const supabase = createServerSupabase();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, order_no, total_amount, payment_status, is_guest, guest_checkout_token, viewpay_merchant_order_no"
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, message: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (!order.is_guest || order.guest_checkout_token !== guestToken) {
      return NextResponse.json({ success: false, message: "비회원 주문이 아닙니다." }, { status: 403 });
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        orderNo: order.order_no,
        message: "이미 결제 완료된 주문입니다.",
        alreadyPaid: true,
      });
    }

    const merchantNo = order.viewpay_merchant_order_no?.trim();
    if (!merchantNo) {
      logger.warn(`${LOG} viewpay_merchant_order_no 없음`, {
        action: "viewpay_guest_sync_no_merchant_no",
        data: { orderId },
      });
      return NextResponse.json(
        {
          success: false,
          message:
            "이 주문에는 ViewPay 가맹점 주문번호가 없습니다. 마이그레이션 이전 주문이거나 결제 준비가 완료되지 않았을 수 있습니다.",
        },
        { status: 400 }
      );
    }

    const attempts: Record<string, unknown>[] = [
      { orderNo: merchantNo, orderId },
      { products: { orderNo: merchantNo }, orderId },
    ];

    let paymentInfo: Record<string, unknown> | null = null;
    let lastErr: string | null = null;

    for (const payload of attempts) {
      try {
        logger.info(`${LOG} get-payment-info 시도`, {
          action: "viewpay_guest_sync_get_info_try",
          data: { orderId, keys: Object.keys(payload) },
        });
        paymentInfo = await viewpayPost("/v1/gw/get-payment-info", payload);
        lastErr = null;
        break;
      } catch (err) {
        if ((err as Error & { response?: { status: number } }).response?.status === 401) {
          clearViewpayTokenCache();
        }
        lastErr = (err as Error).message;
        logger.warn(`${LOG} get-payment-info 실패(다음 시도)`, {
          action: "viewpay_guest_sync_get_info_try_failed",
          data: { orderId, error: lastErr },
        });
      }
    }

    if (!paymentInfo) {
      return NextResponse.json(
        {
          success: false,
          message:
            lastErr ||
            "ViewPay에서 결제 정보를 조회하지 못했습니다. 리다이렉트 URL에 cgTid 포함 여부를 ViewPay에 확인하거나, VIEWPAY_WEBHOOK_URL 연동을 검토해 주세요.",
        },
        { status: 400 }
      );
    }

    const cgTid = extractCgTidFromViewpayPayload(paymentInfo);
    if (!cgTid) {
      logger.warn(`${LOG} 응답에 cgTid 없음`, { action: "viewpay_guest_sync_no_cgtid", data: { orderId } });
      return NextResponse.json(
        {
          success: false,
          message: "결제 조회 응답에서 거래 ID(cgTid)를 찾지 못했습니다. ViewPay 규격을 확인해 주세요.",
        },
        { status: 400 }
      );
    }

    const payOk = isViewpayPaymentSucceeded(paymentInfo);
    if (!payOk.ok) {
      return NextResponse.json({ success: false, message: payOk.message }, { status: 400 });
    }

    try {
      const { newrun } = await finalizeViewpayOrderPaid(supabase, {
        orderId,
        orderNo: order.order_no,
        totalAmount: Number(order.total_amount) || 0,
        cgTid,
      });
      logger.info(`${LOG} 성공`, { action: "viewpay_guest_sync_success", data: { orderId, cgTid } });
      return NextResponse.json({
        success: true,
        orderNo: order.order_no,
        ...(newrun ? { newrun } : {}),
      });
    } catch (err) {
      const msg = (err as Error).message || "주문 반영에 실패했습니다.";
      logger.error(`${LOG} finalize 실패`, { action: "viewpay_guest_sync_finalize_failed", data: { orderId, error: msg } });
      return NextResponse.json({ success: false, message: msg }, { status: 500 });
    }
  } catch (err) {
    logger.error(`${LOG} error`, { action: "viewpay_guest_sync_error", data: { error: String((err as Error).message) } });
    return NextResponse.json(
      { success: false, message: (err as Error).message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

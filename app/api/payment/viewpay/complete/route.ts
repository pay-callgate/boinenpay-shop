import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import { viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";
import { verifyGuestCheckout } from "@/lib/guest-checkout-signature";
import {
  finalizeViewpayOrderPaid,
  isViewpayPaymentSucceeded,
} from "@/lib/viewpay-order-completion";

const LOG = "[Order:Complete]";

/**
 * Phase B2: 결제 완료 콜백 (ViewPay returnUrl → get-payment-info → set-payment-info → DB 반영)
 * GET /api/payment/viewpay/complete?orderId=xxx&cgTid=yyy
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const cgTid = searchParams.get("cgTid");
    const guestToken =
      searchParams.get("guestToken") ?? searchParams.get("guestCheckoutToken");
    const paymentSignature =
      searchParams.get("sig") ?? searchParams.get("paymentSignature");

    logger.info(`${LOG} 요청`, { action: "payment_viewpay_complete_request", data: { orderId, cgTid } });

    if (!orderId || !cgTid) {
      logger.warn(`${LOG} 파라미터 누락`, {
        action: "payment_viewpay_complete_bad_request",
        data: { orderId, cgTid },
      });
      return NextResponse.json(
        { success: false, message: "orderId, cgTid 쿼리 필수입니다." },
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
      logger.warn(`${LOG} 주문 없음`, { action: "payment_viewpay_complete_order_not_found", data: { orderId } });
      return NextResponse.json(
        { success: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (session?.user?.id) {
      if (order.user_id !== session.user.id) {
        logger.warn(`${LOG} 권한 없음`, {
          action: "payment_viewpay_complete_forbidden",
          data: { orderId, userId: session.user.id },
        });
        return NextResponse.json(
          { success: false, message: "해당 주문에 대한 권한이 없습니다." },
          { status: 403 }
        );
      }
    } else {
      const okGuest =
        order.is_guest &&
        order.guest_checkout_token &&
        typeof guestToken === "string" &&
        typeof paymentSignature === "string" &&
        order.guest_checkout_token === guestToken &&
        verifyGuestCheckout(orderId, guestToken, paymentSignature);
      if (!okGuest) {
        logger.warn(`${LOG} 비회원 인증 실패`, {
          action: "payment_viewpay_complete_guest_auth_failed",
          data: { orderId },
        });
        return NextResponse.json(
          { success: false, message: "로그인이 필요하거나 비회원 결제 인증이 올바르지 않습니다." },
          { status: 401 }
        );
      }
    }

    if (order.payment_status === "paid") {
      logger.info(`${LOG} 이미 결제완료(idempotent)`, {
        action: "payment_viewpay_complete_idempotent",
        data: { orderId, orderNo: order.order_no },
      });
      return NextResponse.json({
        success: true,
        orderNo: order.order_no,
        message: "이미 결제 완료된 주문입니다.",
      });
    }

    let paymentInfo: Record<string, unknown>;
    try {
      logger.info(`${LOG} get-payment-info 호출`, {
        action: "payment_viewpay_complete_get_info",
        data: { orderId, cgTid },
      });
      paymentInfo = await viewpayPost("/v1/gw/get-payment-info", {
        cgTid,
        orderId,
      });
    } catch (err) {
      if ((err as Error & { response?: { status: number } }).response?.status === 401) {
        clearViewpayTokenCache();
      }
      logger.error(`${LOG} get-payment-info 실패`, {
        action: "payment_viewpay_complete_get_info_failed",
        data: { orderId, cgTid, error: String((err as Error).message) },
      });
      return NextResponse.json(
        { success: false, message: (err as Error).message || "결제 정보 조회에 실패했습니다." },
        { status: 400 }
      );
    }

    const payOk = isViewpayPaymentSucceeded(paymentInfo);
    if (!payOk.ok) {
      logger.warn(`${LOG} 결제상태 미성공`, {
        action: "payment_viewpay_complete_status_not_success",
        data: { orderId, cgTid, message: payOk.message },
      });
      return NextResponse.json({ success: false, message: payOk.message }, { status: 400 });
    }

    try {
      const { newrun } = await finalizeViewpayOrderPaid(supabase, {
        orderId,
        orderNo: order.order_no,
        totalAmount: Number(order.total_amount) || 0,
        cgTid,
      });
      logger.info(`${LOG} 결제 완료 처리 성공`, {
        action: "payment_viewpay_complete_success",
        data: { orderId, orderNo: order.order_no, cgTid },
      });
      return NextResponse.json({
        success: true,
        orderNo: order.order_no,
        ...(newrun ? { newrun } : {}),
      });
    } catch (err) {
      const msg = (err as Error).message || "주문 반영에 실패했습니다.";
      logger.error(`${LOG} finalize 실패`, {
        action: "payment_viewpay_complete_finalize_failed",
        data: { orderId, cgTid, error: msg },
      });
      return NextResponse.json({ success: false, message: msg }, { status: 500 });
    }
  } catch (err) {
    logger.error(`${LOG} error`, { action: "payment_viewpay_complete_error", data: { error: String((err as Error).message) } });
    return NextResponse.json(
      { success: false, message: (err as Error).message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyGuestCheckout } from "@/lib/guest-checkout-signature";
import { syncViewpayOrderPayment } from "@/lib/viewpay-payment-sync";

const LOG = "[Order:ViewPayGuestSync]";

/**
 * ViewPay가 returnUrl에 cgTid를 붙이지 않은 경우(운영 이슈) 비회원 주문만 서버에서 보정.
 * 공통 sync 모듈(lib/viewpay-payment-sync) 사용.
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
    const cgTid = typeof body.cgTid === "string" ? body.cgTid.trim() : "";

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
    const { data: order } = await supabase
      .from("orders")
      .select("id, is_guest, guest_checkout_token")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ success: false, message: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (!order.is_guest || order.guest_checkout_token !== guestToken) {
      return NextResponse.json({ success: false, message: "비회원 주문이 아닙니다." }, { status: 403 });
    }

    const syncResult = await syncViewpayOrderPayment(supabase, {
      orderId,
      cgTid: cgTid || undefined,
      source: "guest-sync",
    });

    if (!syncResult.ok) {
      const status =
        syncResult.action === "viewpay_payment_sync_order_not_found"
          ? 404
          : syncResult.action === "viewpay_payment_sync_verify_failed"
            ? 400
            : 400;
      return NextResponse.json({ success: false, message: syncResult.message }, { status });
    }

    logger.info(`${LOG} 성공`, {
      action: "viewpay_guest_sync_success",
      data: { orderId, cgTid: syncResult.cgTid },
    });
    return NextResponse.json({
      success: true,
      orderNo: syncResult.orderNo,
      ...(syncResult.alreadyPaid ? { alreadyPaid: true, message: "이미 결제 완료된 주문입니다." } : {}),
      ...(syncResult.newrun ? { newrun: syncResult.newrun } : {}),
    });
  } catch (err) {
    logger.error(`${LOG} error`, { action: "viewpay_guest_sync_error", data: { error: String((err as Error).message) } });
    return NextResponse.json(
      { success: false, message: (err as Error).message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

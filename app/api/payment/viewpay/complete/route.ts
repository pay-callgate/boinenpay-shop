import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import { viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";

/** ViewPay 결제 성공 상태값 (연동규격서 기준) */
const PAYMENT_SUCCESS_STATUSES = [
  "PG_APPROVAL_SUCCESS",
  "PG_MODULE_SUCCESS",
  "PG_MODULE_VIRACC_ISSUE_SUCCESS",
];

const LOG = "[Order:Complete]";

/** get-payment-info 응답의 결제 상태가 객체인 경우 문자열 코드로 정규화 */
function normalizePaymentStatus(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") return raw.trim() || undefined;
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const s = (obj.code ?? obj.status ?? obj.value ?? obj.paymentStatus) as string | undefined;
    return typeof s === "string" ? s.trim() : undefined;
  }
  return undefined;
}

/**
 * Phase B2: 결제 완료 콜백 (ViewPay returnUrl → get-payment-info → set-payment-info → DB 반영)
 * GET /api/payment/viewpay/complete?orderId=xxx&cgTid=yyy
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const cgTid = searchParams.get("cgTid");

    logger.info(`${LOG} 요청`, { action: "payment_viewpay_complete_request", data: { orderId, cgTid } });

    if (!orderId || !cgTid) {
      logger.warn(`${LOG} 파라미터 누락`, { action: "payment_viewpay_complete_bad_request", data: { orderId, cgTid } });
      return NextResponse.json(
        { success: false, message: "orderId, cgTid 쿼리 필수입니다." },
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
      logger.warn(`${LOG} 주문 없음`, { action: "payment_viewpay_complete_order_not_found", data: { orderId } });
      return NextResponse.json(
        { success: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (order.user_id !== session.user.id) {
      logger.warn(`${LOG} 권한 없음`, { action: "payment_viewpay_complete_forbidden", data: { orderId, userId: session.user.id } });
      return NextResponse.json(
        { success: false, message: "해당 주문에 대한 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (order.payment_status === "paid") {
      logger.info(`${LOG} 이미 결제완료(idempotent)`, { action: "payment_viewpay_complete_idempotent", data: { orderId, orderNo: order.order_no } });
      return NextResponse.json({
        success: true,
        orderNo: order.order_no,
        message: "이미 결제 완료된 주문입니다.",
      });
    }

    let paymentInfo: Record<string, unknown>;
    try {
      logger.info(`${LOG} get-payment-info 호출`, { action: "payment_viewpay_complete_get_info", data: { orderId, cgTid } });
      paymentInfo = await viewpayPost("/v1/gw/get-payment-info", {
        cgTid,
        orderId,
      });
    } catch (err) {
      if ((err as Error & { response?: { status: number } }).response?.status === 401) {
        clearViewpayTokenCache();
      }
      logger.error(`${LOG} get-payment-info 실패`, { action: "payment_viewpay_complete_get_info_failed", data: { orderId, cgTid, error: String((err as Error).message) } });
      return NextResponse.json(
        { success: false, message: (err as Error).message || "결제 정보 조회에 실패했습니다." },
        { status: 400 }
      );
    }

    const response = paymentInfo?.response as Record<string, unknown> | undefined;
    const raw = response ?? paymentInfo;
    const rawStatus = raw?.paymentStatus ?? raw?.payment_status ?? raw?.status ?? raw?.payStatus;
    const paymentStatus = normalizePaymentStatus(rawStatus);
    logger.info(`${LOG} get-payment-info 결제상태`, { action: "payment_viewpay_complete_status", data: { orderId, cgTid, rawStatus, paymentStatus } });
    if (!paymentStatus || !PAYMENT_SUCCESS_STATUSES.includes(paymentStatus)) {
      const statusLabel = paymentStatus ?? (typeof rawStatus === "string" ? rawStatus : JSON.stringify(rawStatus ?? "unknown"));
      logger.warn(`${LOG} 결제상태 미성공`, { action: "payment_viewpay_complete_status_not_success", data: { orderId, cgTid, statusLabel } });
      return NextResponse.json(
        {
          success: false,
          message: `결제가 완료되지 않았습니다. (상태: ${statusLabel})`,
        },
        { status: 400 }
      );
    }

    try {
      logger.info(`${LOG} set-payment-info(STORE_SUCCESS) 호출`, { action: "payment_viewpay_complete_set_info", data: { orderId, cgTid } });
      await viewpayPost("/v1/gw/set-payment-info", {
        cgTid,
        orderId,
        orderStatus: "STORE_SUCCESS",
      });
      logger.info(`${LOG} set-payment-info 성공`, { action: "payment_viewpay_complete_set_info_ok", data: { orderId, cgTid } });
    } catch (err) {
      if ((err as Error & { response?: { status: number } }).response?.status === 401) {
        clearViewpayTokenCache();
      }
      logger.error(`${LOG} set-payment-info 실패`, { action: "payment_viewpay_complete_set_info_failed", data: { orderId, cgTid, error: String((err as Error).message) } });
      return NextResponse.json(
        { success: false, message: (err as Error).message || "주문 상태 업데이트에 실패했습니다." },
        { status: 400 }
      );
    }

    const amount = Number(order.total_amount) || 0;
    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        cg_tid: cgTid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateOrderError) {
      logger.error(`${LOG} orders 업데이트 실패`, { action: "payment_viewpay_complete_order_update_failed", data: { orderId, cgTid, error: String(updateOrderError.message) } });
      return NextResponse.json(
        { success: false, message: "주문 상태 반영에 실패했습니다." },
        { status: 500 }
      );
    }

    await supabase.from("order_status_history").insert({
      order_id: orderId,
      status: "received",
      memo: "결제 완료 (ViewPay)",
    });

    const { error: paymentInsertError } = await supabase.from("payments").insert({
      order_id: orderId,
      pg_provider: "viewpay",
      pg_txn_id: cgTid,
      amount,
      status: "completed",
      paid_at: new Date().toISOString(),
    });

    if (paymentInsertError) {
      logger.warn(`${LOG} payments INSERT 실패(무시)`, { action: "payment_viewpay_complete_payment_insert_failed", data: { orderId, cgTid, error: String(paymentInsertError.message) } });
    }

    logger.info(`${LOG} 결제 완료 처리 성공`, { action: "payment_viewpay_complete_success", data: { orderId, orderNo: order.order_no, cgTid } });
    return NextResponse.json({
      success: true,
      orderNo: order.order_no,
    });
  } catch (err) {
    logger.error(`${LOG} error`, { action: "payment_viewpay_complete_error", data: { error: String((err as Error).message) } });
    return NextResponse.json(
      { success: false, message: (err as Error).message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

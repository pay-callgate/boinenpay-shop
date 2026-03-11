import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";

/** ViewPay 결제 성공 상태값 (연동규격서 기준) */
const PAYMENT_SUCCESS_STATUSES = [
  "PG_APPROVAL_SUCCESS",
  "PG_MODULE_SUCCESS",
  "PG_MODULE_VIRACC_ISSUE_SUCCESS",
];

const LOG = "[Order:Complete]";

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

    console.debug(LOG, "요청", { orderId, cgTid });

    if (!orderId || !cgTid) {
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
      console.debug(LOG, "이미 결제완료(idempotent)", { orderId, orderNo: order.order_no });
      return NextResponse.json({
        success: true,
        orderNo: order.order_no,
        message: "이미 결제 완료된 주문입니다.",
      });
    }

    let paymentInfo: Record<string, unknown>;
    try {
      console.debug(LOG, "get-payment-info 호출", { orderId, cgTid });
      paymentInfo = await viewpayPost("/v1/gw/get-payment-info", {
        cgTid,
        orderId,
      });
    } catch (err) {
      if ((err as Error & { response?: { status: number } }).response?.status === 401) {
        clearViewpayTokenCache();
      }
      console.debug(LOG, "get-payment-info 실패", err);
      return NextResponse.json(
        { success: false, message: (err as Error).message || "결제 정보 조회에 실패했습니다." },
        { status: 400 }
      );
    }

    const response = paymentInfo?.response as Record<string, unknown> | undefined;
    const raw = response ?? paymentInfo;
    const paymentStatus = (raw?.paymentStatus ?? raw?.payment_status ?? raw?.status ?? raw?.payStatus) as string | undefined;
    console.debug(LOG, "get-payment-info 결제상태", { paymentStatus });
    if (!paymentStatus || !PAYMENT_SUCCESS_STATUSES.includes(paymentStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: `결제가 완료되지 않았습니다. (상태: ${paymentStatus ?? "unknown"})`,
        },
        { status: 400 }
      );
    }

    try {
      console.debug(LOG, "set-payment-info(STORE_SUCCESS) 호출", { orderId, cgTid });
      await viewpayPost("/v1/gw/set-payment-info", {
        cgTid,
        orderId,
        orderStatus: "STORE_SUCCESS",
      });
      console.debug(LOG, "set-payment-info 성공");
    } catch (err) {
      if ((err as Error & { response?: { status: number } }).response?.status === 401) {
        clearViewpayTokenCache();
      }
      console.debug(LOG, "set-payment-info 실패", err);
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
      console.debug(LOG, "orders 업데이트 실패", updateOrderError);
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
      console.debug(LOG, "payments INSERT 실패(무시)", paymentInsertError);
    }

    console.debug(LOG, "결제 완료 처리 성공", { orderId, orderNo: order.order_no, cgTid });
    return NextResponse.json({
      success: true,
      orderNo: order.order_no,
    });
  } catch (err) {
    console.error(LOG, "error:", err);
    return NextResponse.json(
      { success: false, message: (err as Error).message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

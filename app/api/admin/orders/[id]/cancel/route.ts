import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { executeOrderCancel } from "@/lib/orders/execute-order-cancel";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/orders/[id]/cancel
 * 파트너 어드민(중앙 admin UI): 결제 전액 취소(ViewPay) + 주문 취소
 * — /api/partner/orders/[id]/cancel 과 동일 권한·본문 규약.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "파트너 어드민 취소";

    if (reason.length < 4) {
      return NextResponse.json(
        { error: "취소 사유를 4자 이상 입력해 주세요." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: existingOrder, error: fetchError } = await supabase
      .from("orders")
      .select("id, partner_id")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", existingOrder.partner_id)
      .maybeSingle();

    if (!admin) {
      logger.warn("[API:AdminOrderCancel] 파트너 권한 없음", {
        action: "admin_order_cancel_forbidden",
        userId: session.user.id,
        data: { orderId },
      });
      return NextResponse.json({ error: "해당 주문에 대한 권한이 없습니다." }, { status: 403 });
    }

    logger.info("[API:AdminOrderCancel] 요청 수신", {
      action: "admin_order_cancel_post",
      userId: session.user.id,
      data: { orderId, reasonChars: reason.length },
    });

    const partnerOperatorLabel =
      session.user.email?.trim() || session.user.name?.trim() || session.user.id;

    const result = await executeOrderCancel(supabase, {
      orderId,
      reason,
      actor: "partner",
      partnerOperatorLabel,
    });

    if (!result.ok) {
      logger.warn("[API:AdminOrderCancel] 처리 실패", {
        action: "admin_order_cancel_failed",
        userId: session.user.id,
        data: {
          orderId,
          code: result.code,
          status: result.status ?? 400,
        },
      });
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status ?? 400 }
      );
    }

    logger.info("[API:AdminOrderCancel] 성공", {
      action: "admin_order_cancel_ok",
      userId: session.user.id,
      data: { orderId, idempotent: result.idempotent === true },
    });

    return NextResponse.json({
      success: true,
      idempotent: result.idempotent === true,
      message: result.idempotent ? "이미 취소된 주문입니다." : "결제 취소 및 주문 취소가 완료되었습니다.",
    });
  } catch (err) {
    console.error("[api/admin/orders/cancel] POST", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

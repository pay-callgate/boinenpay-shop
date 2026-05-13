import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { recordOrderPartnerNotifyEventSafe } from "@/lib/order-partner-notify-events";
import { canPartnerAdminCancelOrder } from "@/lib/orders/cancel-eligibility";

/**
 * 파트너 어드민 전용: 주문 상세 조회
 * GET /api/partner/orders/[id]
 * - partner_admins 권한 검사 후 해당 파트너 소속 주문만 조회
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerSupabase();

    // 주문 id로 조회 (소속 파트너 확인용)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        *,
        client:clients (
          id,
          name,
          slug,
          logo_url,
          newrun_default_florist_draft
        ),
        user:users (
          id,
          name,
          email,
          phone
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // 파트너 어드민 권한 검사: 해당 주문의 partner_id에 대한 관리자만 허용
    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", order.partner_id)
      .maybeSingle();

    if (!admin) {
      return NextResponse.json({ error: "해당 주문에 대한 조회 권한이 없습니다." }, { status: 403 });
    }

    // 주문 항목 조회
    const { data: items } = await supabase
      .from("order_items")
      .select(
        `
        *,
        product:products (
          id,
          name,
          slug,
          thumbnail_url,
          newrun_default_product_draft,
          newrun_default_option_draft
        )
      `
      )
      .eq("order_id", id)
      .order("created_at", { ascending: true });

    // 상태 이력 조회
    const { data: history } = await supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false });

    const paymentCancel = canPartnerAdminCancelOrder(
      order as {
        payment_status: string | null;
        status: string | null;
        newrun_delivery_info?: unknown;
      }
    );

    return NextResponse.json({
      order,
      items: items || [],
      history: history || [],
      partner_payment_cancel: paymentCancel.ok
        ? { allowed: true, message: null as string | null }
        : { allowed: false, message: paymentCancel.message },
    });
  } catch (err) {
    console.error("Partner order detail GET API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * 파트너 어드민 전용: 주문 상태 변경
 * PATCH /api/partner/orders/[id]
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, trackingNumber, courierCompany, memo } = body;

    if (!status) {
      return NextResponse.json({ error: "상태 정보가 필요합니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data: existingOrder, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // 파트너 어드민 권한 검사
    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", existingOrder.partner_id)
      .maybeSingle();

    if (!admin) {
      return NextResponse.json({ error: "해당 주문에 대한 수정 권한이 없습니다." }, { status: 403 });
    }

    const postPaymentStatuses = new Set([
      "preparing",
      "shipping",
      "delivered",
      "confirmed_purchase",
    ]);
    if (
      postPaymentStatuses.has(status) &&
      existingOrder.payment_status !== "paid"
    ) {
      return NextResponse.json(
        {
          error:
            "결제가 완료된 주문만 배송 준비·배송 중·배송 완료·구매 확정 상태로 변경할 수 있습니다. 결제 상태를 먼저 확인해 주세요.",
        },
        { status: 400 }
      );
    }

    const updateData: {
      status: string;
      tracking_number?: string | null;
      courier_company?: string | null;
    } = { status };
    if (trackingNumber !== undefined) {
      updateData.tracking_number = trackingNumber;
    }
    if (courierCompany !== undefined) {
      updateData.courier_company = courierCompany || null;
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Partner order update error:", updateError);
      return NextResponse.json({ error: "주문 업데이트 실패" }, { status: 500 });
    }

    // 주문 취소 시 재고 복구
    if (status === "cancelled" && existingOrder.status !== "cancelled") {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", id);

      if (orderItems?.length) {
        for (const item of orderItems) {
          const { data: product } = await supabase
            .from("products")
            .select("stock_qty, status")
            .eq("id", item.product_id)
            .single();

          if (product) {
            const restoredStockQty = (product.stock_qty || 0) + item.quantity;
            const restoreData: { stock_qty: number; status?: string } = { stock_qty: restoredStockQty };
            if (restoredStockQty > 0 && product.status === "sold_out") {
              restoreData.status = "active";
            }
            await supabase.from("products").update(restoreData).eq("id", item.product_id);
          }
        }
      }
    }

    await supabase.from("order_status_history").insert({
      order_id: id,
      status,
      memo: memo || null,
    });

    if (status === "cancelled" && existingOrder.status !== "cancelled") {
      await recordOrderPartnerNotifyEventSafe(supabase, {
        orderId: id,
        partnerId: existingOrder.partner_id,
        kind: "order_cancelled",
        source: "partner_orders_patch",
        payload: { previousStatus: existingOrder.status },
      });
    }

    return NextResponse.json({
      order: updatedOrder,
      message: "주문 상태가 업데이트되었습니다.",
    });
  } catch (err) {
    console.error("Partner order PATCH API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

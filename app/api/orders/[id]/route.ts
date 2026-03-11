import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T5-2: 주문 상세 조회 API
 * GET /api/orders/[id]
 * - 주문 정보, 주문 항목, 상태 이력 조회
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

    // 주문 조회: 본인 주문만 접근 가능 (고객용 API - 엄격한 테넌트 격리)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        *,
        client:clients (
          id,
          name,
          slug,
          logo_url
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
      .eq("user_id", session.user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
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
          thumbnail_url
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

    return NextResponse.json({
      order,
      items: items || [],
      history: history || [],
    });
  } catch (err) {
    console.error("Order detail GET API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * T5-3: 주문 상태 변경 API
 * PATCH /api/orders/[id]
 * - 주문 상태 업데이트
 * - 송장 번호 입력
 * - 상태 이력 기록
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

    // 주문 존재 및 소유자 확인 (고객용 API: 본인 주문만 수정 가능)
    const { data: existingOrder, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single();

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // 주문 상태 업데이트
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
      console.error("Order update error:", updateError);
      return NextResponse.json({ error: "주문 업데이트 실패" }, { status: 500 });
    }

    // [기능-2] 주문 취소 시 재고 복구
    if (status === "cancelled" && existingOrder.status !== "cancelled") {
      // 주문 항목 조회
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", id);

      if (orderItems && orderItems.length > 0) {
        // 각 상품의 재고 복구
        for (const item of orderItems) {
          // 현재 상품 정보 조회
          const { data: product } = await supabase
            .from("products")
            .select("stock_qty, status")
            .eq("id", item.product_id)
            .single();

          if (product) {
            const restoredStockQty = (product.stock_qty || 0) + item.quantity;

            // 재고 복구 및 품절 상태 해제 (재고가 1 이상이면)
            const restoreData: { stock_qty: number; status?: string } = {
              stock_qty: restoredStockQty,
            };

            if (restoredStockQty > 0 && product.status === "sold_out") {
              restoreData.status = "active";
            }

            const { error: stockError } = await supabase
              .from("products")
              .update(restoreData)
              .eq("id", item.product_id);

            if (stockError) {
              console.error(`Stock restore error for product ${item.product_id}:`, stockError);
              // 재고 복구 실패는 주문 취소를 막지 않음 (로그만 기록)
            }
          }
        }
      }
    }

    // 상태 이력 추가
    await supabase.from("order_status_history").insert({
      order_id: id,
      status,
      memo: memo || null,
    });

    return NextResponse.json({
      order: updatedOrder,
      message: "주문 상태가 업데이트되었습니다.",
    });
  } catch (err) {
    console.error("Order PATCH API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

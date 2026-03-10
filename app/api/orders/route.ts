import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import { logApiRequest } from "@/lib/logger";

/**
 * T4-5 & T5-1: 주문 API
 * GET /api/orders - 주문 목록 조회 (파트너 어드민용)
 * POST /api/orders - 주문 생성 (쇼핑몰용)
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!partnerId) {
      return NextResponse.json({ error: "partnerId가 필요합니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // 파트너 어드민만 해당 파트너 주문 조회 가능 (테넌트 격리)
    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", partnerId)
      .maybeSingle();
    if (!admin) {
      return NextResponse.json({ error: "해당 파트너 주문 조회 권한이 없습니다." }, { status: 403 });
    }

    // 기본 쿼리
    let query = supabase
      .from("orders")
      .select(
        `
        *,
        client:clients (
          id,
          name,
          slug
        ),
        user:users (
          id,
          name,
          email
        )
      `,
        { count: "exact" }
      )
      .eq("partner_id", partnerId);

    // 거래처 필터
    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    // 상태 필터
    if (status) {
      query = query.eq("status", status);
    }

    // 날짜 필터
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    // 정렬 및 페이지네이션
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      console.error("Orders fetch error:", error);
      return NextResponse.json({ error: "주문 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({
      orders: orders || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("Orders GET API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    logApiRequest("INFO", request, {
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: "orders_create",
      data: { bodyPreview: await request.clone().json().catch(() => undefined) },
    });

    const body = await request.json();
    const {
      partnerId,
      clientId,
      cartItemIds,
      shippingName,
      shippingPhone,
      shippingPostcode,
      shippingAddress,
      shippingDetail,
      deliveryDate,
      deliveryTimeSlot,
      deliveryMethod,
      deliveryFee,
      paymentMethod,
    } = body;

    // 필수 항목 검증
    if (
      !partnerId ||
      !clientId ||
      !cartItemIds ||
      cartItemIds.length === 0 ||
      !shippingName ||
      !shippingPhone ||
      !shippingAddress ||
      !paymentMethod
    ) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // clientId가 해당 partner 소속인지 검증 (테넌트 격리)
    const { data: clientRow } = await supabase
      .from("clients")
      .select("id, partner_id")
      .eq("id", clientId)
      .single();
    if (!clientRow || clientRow.partner_id !== partnerId) {
      return NextResponse.json(
        { error: "거래처 정보가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // 장바구니 항목 조회 (cart 소유권·client_id 검증용 join)
    const { data: cartItems, error: cartError } = await supabase
      .from("cart_items")
      .select(
        `
        *,
        cart:carts!inner (
          user_id,
          client_id
        ),
        product:products (
          id,
          name,
          base_price,
          sale_price,
          status,
          stock_qty
        )
      `
      )
      .in("id", cartItemIds);

    if (cartError || !cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: "장바구니 항목을 찾을 수 없습니다." }, { status: 404 });
    }

    // 본인 장바구니이며, 요청한 client_id와 일치하는지 검증 (테넌트 격리)
    const invalidItem = cartItems.find(
      (item: { cart: { user_id: string; client_id: string } }) =>
        item.cart.user_id !== session.user.id || item.cart.client_id !== clientId
    );
    if (invalidItem) {
      return NextResponse.json(
        { error: "장바구니 항목에 대한 권한이 없거나 거래처가 일치하지 않습니다." },
        { status: 403 }
      );
    }

    // 품절 상품 확인
    const soldOutItems = cartItems.filter((item: { product: { status: string } }) => item.product.status === "sold_out");
    if (soldOutItems.length > 0) {
      return NextResponse.json({ error: "품절된 상품이 포함되어 있습니다." }, { status: 400 });
    }

    // 총 금액 계산 (상품 합계 + 배송비)
    let productTotal = 0;
    cartItems.forEach((item: { product: { base_price: number; sale_price: number | null }; quantity: number }) => {
      const price = item.product.sale_price || item.product.base_price;
      productTotal += price * item.quantity;
    });
    const deliveryFeeNum = typeof deliveryFee === "number" ? deliveryFee : 0;
    const totalAmount = productTotal + deliveryFeeNum;

    // 주문 번호 생성 (예: ORD20240210XXXXX)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = randomBytes(4).toString("hex").toUpperCase().slice(0, 5);
    const orderNo = `ORD${today}${randomSuffix}`;

    // 주문 생성
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        partner_id: partnerId,
        client_id: clientId,
        user_id: session.user.id,
        order_no: orderNo,
        status: "received",
        order_channel: "link",
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: "pending",
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        shipping_postcode: shippingPostcode || null,
        shipping_address: shippingAddress,
        shipping_detail: shippingDetail || null,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Order creation error:", orderError);
      return NextResponse.json({ error: "주문 생성에 실패했습니다." }, { status: 500 });
    }

    // 주문 항목 생성
    const orderItems = cartItems.map((item: {
      product_id: string;
      product: { name: string; base_price: number; sale_price: number | null };
      option_json: object | null;
      quantity: number;
    }) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product.name,
      option_json: item.option_json,
      quantity: item.quantity,
      unit_price: item.product.sale_price || item.product.base_price,
      total_price: (item.product.sale_price || item.product.base_price) * item.quantity,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

    if (itemsError) {
      console.error("Order items creation error:", itemsError);
      // 주문 생성 실패 시 주문 삭제 (트랜잭션 대신)
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "주문 항목 생성에 실패했습니다." }, { status: 500 });
    }

    // [개선-1] 재고 자동 차감 및 [개선-2] 품절 자동 전환
    for (const item of cartItems) {
      const newStockQty = (item.product.stock_qty || 0) - item.quantity;
      
      // 재고 차감
      const updateData: { stock_qty: number; status?: string } = {
        stock_qty: Math.max(0, newStockQty), // 음수 방지
      };

      // 재고가 0이 되면 자동으로 품절 처리
      if (newStockQty <= 0) {
        updateData.status = "sold_out";
      }

      const { error: stockError } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", item.product_id);

      if (stockError) {
        console.error(`Stock update error for product ${item.product_id}:`, stockError);
        // 재고 차감 실패는 주문 생성을 막지 않음 (로그만 기록)
      }
    }

    // 주문 상태 히스토리 생성
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "received",
      memo: "주문 생성",
    });

    // [기능-1] 신규 주문 알림 발송 (비동기, 실패해도 주문 생성은 완료)
    const { sendOrderNotification } = await import("@/lib/notifications");
    
    // 파트너 정보 조회 (이메일, 전화번호)
    const { data: partner } = await supabase
      .from("partners")
      .select("company_name, contact_email, contact_phone")
      .eq("id", partnerId)
      .single();

    // 거래처 정보 조회
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .single();

    if (partner && client) {
      // 알림 발송 (비동기, 에러 무시)
      sendOrderNotification({
        orderNo: order.order_no,
        clientName: client.name,
        totalAmount,
        partnerEmail: partner.contact_email,
        partnerPhone: partner.contact_phone,
      }).catch((err) => {
        console.error("Order notification error:", err);
      });
    }

    // 장바구니 항목 삭제
    await supabase.from("cart_items").delete().in("id", cartItemIds);

    return NextResponse.json({
      order,
      message: "주문이 생성되었습니다.",
    });
  } catch (err) {
    console.error("Order POST API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

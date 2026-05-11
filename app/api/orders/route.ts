import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { randomBytes, randomUUID } from "crypto";
import { logApiRequest } from "@/lib/logger";
import { userBelongsToClient } from "@/lib/mypage-client-access";
import { CART_SESSION_COOKIE } from "@/lib/cart-session-cookie";
import { hashGuestPassword } from "@/lib/guest-password";
import { signGuestCheckout } from "@/lib/guest-checkout-signature";
import {
  effectiveGuestUnitPrice,
  effectiveMemberUnitPrice,
} from "@/lib/product-pricing";
import { floristFieldsFromOrderBody } from "@/lib/orders/florist-order-payload";
import { getUnreadNotifyOrderIdsForPartnerUser } from "@/lib/order-partner-notify-events";

/**
 * T4-5 & T5-1: 주문 API
 * GET /api/orders - 주문 목록 조회 (파트너 어드민용)
 * POST /api/orders - 주문 생성 (회원 / 비회원)
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
    /** 쉼표 구분 — 취소/반품 목록 등 복수 상태 (Phase 8.4). `status`와 동시 지정 시 이쪽 우선 */
    const statusIn = searchParams.get("statusIn");
    const paymentStatus = searchParams.get("paymentStatus");
    /** Phase 8.1: not_sent | ok | failed | needs_attention */
    const newrunSubmit = searchParams.get("newrunSubmit");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    /** 희망 배송일(desired_delivery_date) 구간 — YYYY-MM-DD */
    const desiredDeliveryFrom = searchParams.get("desiredDeliveryFrom");
    const desiredDeliveryTo = searchParams.get("desiredDeliveryTo");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!partnerId) {
      return NextResponse.json({ error: "partnerId가 필요합니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", partnerId)
      .maybeSingle();
    if (!admin) {
      return NextResponse.json({ error: "해당 파트너 주문 조회 권한이 없습니다." }, { status: 403 });
    }

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

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    if (statusIn) {
      const parts = statusIn
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        query = query.in("status", parts);
      }
    } else if (status) {
      query = query.eq("status", status);
    }

    if (paymentStatus) {
      query = query.eq("payment_status", paymentStatus);
    }

    if (newrunSubmit && newrunSubmit !== "all") {
      switch (newrunSubmit) {
        case "not_sent":
          query = query.eq("payment_status", "paid").is("newrun_submit_status", null);
          break;
        case "ok":
          query = query.in("newrun_submit_status", ["success", "duplicate"]);
          break;
        case "failed":
          query = query.eq("newrun_submit_status", "failed");
          break;
        case "needs_attention":
          query = query.eq("newrun_submit_status", "skipped");
          break;
        default:
          break;
      }
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    if (desiredDeliveryFrom) {
      query = query.gte("desired_delivery_date", desiredDeliveryFrom);
    }
    if (desiredDeliveryTo) {
      query = query.lte("desired_delivery_date", desiredDeliveryTo);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      console.error("Orders fetch error:", error);
      return NextResponse.json({ error: "주문 조회 실패" }, { status: 500 });
    }

    let list = orders || [];
    if (searchParams.get("withNotify") === "1" && list.length > 0) {
      const unreadSet = await getUnreadNotifyOrderIdsForPartnerUser(
        supabase,
        partnerId,
        session.user.id,
        list.map((o) => String((o as { id: string }).id))
      );
      list = list.map((o) => ({
        ...o,
        notify_unread_for_me: unreadSet.has(String((o as { id: string }).id)),
      }));
    }

    return NextResponse.json({
      orders: list,
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("Orders GET API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

const PRODUCT_SELECT = `
  id,
  name,
  base_price,
  sale_price,
  member_price,
  status,
  stock_qty
`;

/** DB orders.shipping_postcode NOT NULL 대응 — 빈 값이면 대체값 */
function normalizeOrderPostcode(raw: unknown): string {
  if (raw == null) return "00000";
  const s = String(raw).trim();
  if (!s) return "00000";
  return s.length > 10 ? s.slice(0, 10) : s;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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
      deliveryFee,
      paymentMethod,
      guestPassword,
      isGuest: rawIsGuest,
      ordererName: rawOrdererName,
      guestOrdererEmail: rawGuestOrdererEmail,
    } = body;

    const isGuestFlow = rawIsGuest === true && !session?.user?.id;

    if (!isGuestFlow && !session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

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

    if (isGuestFlow) {
      const pw =
        typeof guestPassword === "string" ? guestPassword.trim() : "";
      if (pw.length < 4) {
        return NextResponse.json(
          { error: "주문 조회용 비밀번호는 4자 이상 입력해 주세요." },
          { status: 400 }
        );
      }
    }

    if (!isGuestFlow && session?.user?.id) {
      logApiRequest("INFO", request, {
        userId: session.user.id,
        userEmail: session.user.email ?? undefined,
        action: "orders_create",
        data: { bodyPreview: await request.clone().json().catch(() => undefined) },
      });
    }

    const supabase = createServerSupabase();

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

    const useMemberPrice = !isGuestFlow;

    if (!isGuestFlow && session?.user?.id) {
      const belongs = await userBelongsToClient(supabase, session.user.id, clientId);
      if (!belongs) {
        return NextResponse.json(
          { error: "이 전용몰의 소속 회원만 주문할 수 있습니다." },
          { status: 403 }
        );
      }
    }

    const cartSessionId = request.cookies.get(CART_SESSION_COOKIE)?.value ?? null;

    const { data: cartItems, error: cartError } = await supabase
      .from("cart_items")
      .select(
        `
        *,
        cart:carts!inner (
          user_id,
          client_id,
          session_id
        ),
        product:products (
          ${PRODUCT_SELECT}
        )
      `
      )
      .in("id", cartItemIds);

    if (cartError || !cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: "장바구니 항목을 찾을 수 없습니다." }, { status: 404 });
    }

    type CartInner = {
      user_id: string | null;
      client_id: string;
      session_id: string | null;
    };

    if (isGuestFlow) {
      if (!cartSessionId) {
        return NextResponse.json(
          { error: "비회원 장바구니 세션이 없습니다. 장바구니를 다시 담아 주세요." },
          { status: 400 }
        );
      }
      const bad = cartItems.find(
        (item: { cart: CartInner }) =>
          item.cart.client_id !== clientId ||
          item.cart.session_id !== cartSessionId ||
          item.cart.user_id != null
      );
      if (bad) {
        return NextResponse.json(
          { error: "장바구니 항목에 대한 권한이 없거나 거래처가 일치하지 않습니다." },
          { status: 403 }
        );
      }
    } else if (session?.user?.id) {
      const invalidItem = cartItems.find(
        (item: { cart: CartInner }) =>
          item.cart.user_id !== session.user.id || item.cart.client_id !== clientId
      );
      if (invalidItem) {
        return NextResponse.json(
          { error: "장바구니 항목에 대한 권한이 없거나 거래처가 일치하지 않습니다." },
          { status: 403 }
        );
      }
    }

    const notPurchasable = cartItems.filter(
      (item: { product: { status: string } }) => item.product.status !== "active"
    );
    if (notPurchasable.length > 0) {
      const hasSoldOut = notPurchasable.some(
        (item: { product: { status: string } }) => item.product.status === "sold_out"
      );
      return NextResponse.json(
        {
          error: hasSoldOut
            ? "품절된 상품이 포함되어 있습니다."
            : "판매 중인 상품만 주문할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    let productTotal = 0;
    cartItems.forEach(
      (item: {
        product: {
          base_price: number;
          sale_price: number | null;
          member_price?: number | null;
        };
        quantity: number;
      }) => {
        const unit = useMemberPrice
          ? effectiveMemberUnitPrice(item.product)
          : effectiveGuestUnitPrice(item.product);
        productTotal += unit * item.quantity;
      }
    );
    const deliveryFeeNum = typeof deliveryFee === "number" ? deliveryFee : 0;
    const totalAmount = productTotal + deliveryFeeNum;

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = randomBytes(4).toString("hex").toUpperCase().slice(0, 5);
    const orderNo = `ORD${today}${randomSuffix}`;

    const guestCheckoutToken = isGuestFlow ? randomUUID() : null;
    const guestPasswordHash = isGuestFlow
      ? hashGuestPassword(String(guestPassword).trim())
      : null;

    const ordererNameTrim =
      typeof rawOrdererName === "string" ? rawOrdererName.trim() : "";
    const ordererNameFinal =
      ordererNameTrim ||
      (!isGuestFlow && session?.user?.name ? String(session.user.name).trim() : "");
    const guestEmailTrim =
      isGuestFlow && typeof rawGuestOrdererEmail === "string"
        ? rawGuestOrdererEmail.trim()
        : "";

    const floristPayload = floristFieldsFromOrderBody(body as Record<string, unknown>);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        partner_id: partnerId,
        client_id: clientId,
        user_id: isGuestFlow ? null : session!.user!.id,
        order_no: orderNo,
        status: "received",
        order_channel: "link",
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: "pending",
        shipping_name: shippingName,
        shipping_phone: shippingPhone,
        shipping_postcode: normalizeOrderPostcode(shippingPostcode),
        shipping_address: shippingAddress,
        shipping_detail: shippingDetail || null,
        is_guest: isGuestFlow,
        guest_checkout_token: guestCheckoutToken,
        guest_password_hash: guestPasswordHash,
        orderer_name: ordererNameFinal || null,
        guest_orderer_email: guestEmailTrim || null,
        ...floristPayload,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("[Order:Create] 주문 생성 실패", orderError);
      const errBody: Record<string, unknown> = { error: "주문 생성에 실패했습니다." };
      if (orderError?.message) errBody.details = orderError.message;
      if (orderError && "hint" in orderError && orderError.hint) errBody.hint = orderError.hint;
      if (orderError && "code" in orderError && orderError.code) errBody.code = orderError.code;
      return NextResponse.json(errBody, { status: 500 });
    }

    console.debug("[Order:Create] 주문 생성 완료", {
      orderId: order.id,
      order_no: order.order_no,
      total_amount: order.total_amount,
      is_guest: isGuestFlow,
      client_id: clientId,
    });

    const orderItems = cartItems.map(
      (item: {
        product_id: string;
        product: {
          name: string;
          base_price: number;
          sale_price: number | null;
          member_price?: number | null;
        };
        option_json: object | null;
        quantity: number;
      }) => {
        const unit = useMemberPrice
          ? effectiveMemberUnitPrice(item.product)
          : effectiveGuestUnitPrice(item.product);
        return {
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product.name,
          option_json: item.option_json,
          quantity: item.quantity,
          unit_price: unit,
          total_price: unit * item.quantity,
        };
      }
    );

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

    if (itemsError) {
      console.error("[Order:Create] 주문 항목 생성 실패", itemsError);
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "주문 항목 생성에 실패했습니다." }, { status: 500 });
    }

    const stockUpdates = cartItems.map(
      (item: { product_id: string; product: { stock_qty?: number }; quantity: number }) => {
        const newStockQty = (item.product.stock_qty || 0) - item.quantity;
        const updateData: { stock_qty: number; status?: string } = {
          stock_qty: Math.max(0, newStockQty),
        };
        if (newStockQty <= 0) updateData.status = "sold_out";
        return supabase.from("products").update(updateData).eq("id", item.product_id);
      }
    );
    const stockResults = await Promise.all(stockUpdates);
    stockResults.forEach((r, i) => {
      if (r.error) {
        console.error(`Stock update error for product ${cartItems[i].product_id}:`, r.error);
      }
    });

    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "received",
      memo: isGuestFlow ? "비회원 주문 생성" : "주문 생성",
    });

    const { sendOrderNotification } = await import("@/lib/notifications");

    const { data: partner } = await supabase
      .from("partners")
      .select("company_name, contact_email, contact_phone")
      .eq("id", partnerId)
      .single();

    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .single();

    if (partner && client) {
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

    await supabase.from("cart_items").delete().in("id", cartItemIds);

    const baseJson: Record<string, unknown> = {
      order,
      message: "주문이 생성되었습니다.",
    };

    if (isGuestFlow && guestCheckoutToken) {
      baseJson.guestCheckoutToken = guestCheckoutToken;
      baseJson.paymentSignature = signGuestCheckout(order.id, guestCheckoutToken);
    }

    return NextResponse.json(baseJson);
  } catch (err) {
    console.error("Order POST API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

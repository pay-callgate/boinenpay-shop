import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T4-4: 장바구니 API
 * GET /api/cart?clientId=xxx
 * POST /api/cart (장바구니 항목 추가)
 * - 로그인 사용자 기반 장바구니
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ error: "clientId가 필요합니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // 사용자의 장바구니 조회 (없으면 생성)
    let { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (cartError && cartError.code !== "PGRST116") {
      console.error("Cart fetch error:", cartError);
      return NextResponse.json({ error: "장바구니 조회 실패" }, { status: 500 });
    }

    if (!cart) {
      // 장바구니 생성
      const { data: newCart, error: createError } = await supabase
        .from("carts")
        .insert({
          user_id: session.user.id,
          client_id: clientId,
        })
        .select()
        .single();

      if (createError) {
        console.error("Cart create error:", createError);
        return NextResponse.json({ error: "장바구니 생성 실패" }, { status: 500 });
      }

      cart = newCart;
    }

    // 장바구니 항목 조회
    const { data: items, error: itemsError } = await supabase
      .from("cart_items")
      .select(
        `
        *,
        product:products (
          id,
          name,
          slug,
          thumbnail_url,
          base_price,
          sale_price,
          status,
          stock_qty
        )
      `
      )
      .eq("cart_id", cart.id)
      .order("created_at", { ascending: false });

    if (itemsError) {
      console.error("Cart items fetch error:", itemsError);
      return NextResponse.json({ error: "장바구니 항목 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({
      cart,
      items: items || [],
    });
  } catch (err) {
    console.error("Cart API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, productId, optionJson, quantity } = body;

    if (!clientId || !productId || !quantity) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // 거래처·상품 동일 파트너 소속 검증 (테넌트 격리: 타 거래처 상품 담기 방지)
    const [{ data: clientRow }, { data: productRow }] = await Promise.all([
      supabase.from("clients").select("id, partner_id").eq("id", clientId).single(),
      supabase.from("products").select("id, partner_id").eq("id", productId).single(),
    ]);
    if (!clientRow || !productRow || clientRow.partner_id !== productRow.partner_id) {
      return NextResponse.json(
        { error: "해당 거래처 쇼핑몰의 상품만 장바구니에 담을 수 있습니다." },
        { status: 400 }
      );
    }

    // 장바구니 조회 또는 생성
    let { data: cart } = await supabase
      .from("carts")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (!cart) {
      const { data: newCart, error: createError } = await supabase
        .from("carts")
        .insert({
          user_id: session.user.id,
          client_id: clientId,
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: "장바구니 생성 실패" }, { status: 500 });
      }

      cart = newCart;
    }

    // 동일 상품 + 옵션이 이미 있는지 확인
    const { data: existingItems } = await supabase
      .from("cart_items")
      .select("*")
      .eq("cart_id", cart.id)
      .eq("product_id", productId);

    // 옵션이 동일한 항목 찾기
    const existingItem = (existingItems || []).find((item: { option_json: object | null }) => {
      if (!optionJson && !item.option_json) return true;
      return JSON.stringify(item.option_json) === JSON.stringify(optionJson);
    });

    if (existingItem) {
      // 수량 증가
      const { data: updated, error: updateError } = await supabase
        .from("cart_items")
        .update({ quantity: existingItem.quantity + quantity })
        .eq("id", existingItem.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: "장바구니 업데이트 실패" }, { status: 500 });
      }

      return NextResponse.json({ cartItem: updated, message: "장바구니에 추가되었습니다." });
    } else {
      // 새 항목 추가
      const { data: newItem, error: insertError } = await supabase
        .from("cart_items")
        .insert({
          cart_id: cart.id,
          product_id: productId,
          option_json: optionJson || null,
          quantity,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: "장바구니 추가 실패" }, { status: 500 });
      }

      return NextResponse.json({ cartItem: newItem, message: "장바구니에 추가되었습니다." });
    }
  } catch (err) {
    console.error("Cart POST API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

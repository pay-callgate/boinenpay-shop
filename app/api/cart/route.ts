import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { userBelongsToClient } from "@/lib/mypage-client-access";
import { randomUUID } from "crypto";
import { CART_SESSION_COOKIE, CART_SESSION_MAX_AGE } from "@/lib/cart-session-cookie";

/**
 * T4-4: 장바구니 API
 * GET /api/cart?clientId=xxx
 * POST /api/cart
 * - 로그인: user_id 기반
 * - 비회원: 쿠키 calllink_cart_sid + carts.session_id
 */

function appendCartCookie(res: NextResponse, sessionId: string) {
  res.cookies.set(CART_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_SESSION_MAX_AGE,
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const countOnly = searchParams.get("countOnly") === "1";

    if (!clientId) {
      return NextResponse.json({ error: "clientId가 필요합니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    if (session?.user?.id) {
      const belongs = await userBelongsToClient(supabase, session.user.id, clientId);
      if (!belongs) {
        return NextResponse.json(
          { error: "이 전용몰의 소속 회원만 장바구니를 이용할 수 있습니다." },
          { status: 403 }
        );
      }

      if (countOnly) {
        const { data: cart } = await supabase
          .from("carts")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("client_id", clientId)
          .maybeSingle();

        if (!cart) {
          return NextResponse.json({ count: 0 });
        }

        const { count, error: countError } = await supabase
          .from("cart_items")
          .select("*", { count: "exact", head: true })
          .eq("cart_id", cart.id);

        if (countError) {
          return NextResponse.json({ count: 0 });
        }
        return NextResponse.json({ count: count ?? 0 });
      }

      let { data: cart, error: cartError } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (cartError && cartError.code !== "PGRST116") {
        return NextResponse.json({ error: "장바구니 조회 실패" }, { status: 500 });
      }

      if (!cart) {
        const { data: newCart, error: createError } = await supabase
          .from("carts")
          .insert({
            user_id: session.user.id,
            client_id: clientId,
          })
          .select("id")
          .single();

        if (createError) {
          return NextResponse.json({ error: "장바구니 생성 실패" }, { status: 500 });
        }

        cart = newCart;
      }

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
          member_price,
          status,
          stock_qty
        )
      `
        )
        .eq("cart_id", cart.id)
        .order("created_at", { ascending: false });

      if (itemsError) {
        return NextResponse.json({ error: "장바구니 항목 조회 실패" }, { status: 500 });
      }

      return NextResponse.json({
        cart: { id: cart.id },
        items: items || [],
      });
    }

    // 비회원: session_id 쿠키
    let sessionId = request.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
    if (!sessionId || sessionId.length < 8) {
      sessionId = randomUUID();
    }

    if (countOnly) {
      const { data: cart } = await supabase
        .from("carts")
        .select("id")
        .eq("session_id", sessionId)
        .eq("client_id", clientId)
        .maybeSingle();

      let cnt = 0;
      if (cart) {
        const { count, error: countError } = await supabase
          .from("cart_items")
          .select("*", { count: "exact", head: true })
          .eq("cart_id", cart.id);
        if (!countError) cnt = count ?? 0;
      }
      const r = NextResponse.json({ count: cnt });
      appendCartCookie(r, sessionId);
      return r;
    }

    let { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("id")
      .eq("session_id", sessionId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (cartError && cartError.code !== "PGRST116") {
      return NextResponse.json({ error: "장바구니 조회 실패" }, { status: 500 });
    }

    if (!cart) {
      const { data: newCart, error: createError } = await supabase
        .from("carts")
        .insert({
          session_id: sessionId,
          client_id: clientId,
          user_id: null,
        })
        .select("id")
        .single();

      if (createError) {
        return NextResponse.json({ error: "장바구니 생성 실패" }, { status: 500 });
      }

      cart = newCart;
    }

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
          member_price,
          status,
          stock_qty
        )
      `
      )
      .eq("cart_id", cart!.id)
      .order("created_at", { ascending: false });

    if (itemsError) {
      return NextResponse.json({ error: "장바구니 항목 조회 실패" }, { status: 500 });
    }

    const json = NextResponse.json({
      cart: { id: cart!.id },
      items: items || [],
    });
    appendCartCookie(json, sessionId);
    return json;
  } catch (err) {
    console.error("Cart API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { clientId, productId, optionJson, quantity } = body;

    if (!clientId || !productId || !quantity) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    if (session?.user?.id) {
      const belongs = await userBelongsToClient(supabase, session.user.id, clientId);
      if (!belongs) {
        return NextResponse.json(
          { error: "이 전용몰의 소속 회원만 장바구니에 담을 수 있습니다." },
          { status: 403 }
        );
      }
    }

    const [{ data: clientRow }, { data: productRow }] = await Promise.all([
      supabase.from("clients").select("id, partner_id").eq("id", clientId).single(),
      supabase
        .from("products")
        .select("id, partner_id, status")
        .eq("id", productId)
        .single(),
    ]);
    if (!clientRow || !productRow || clientRow.partner_id !== productRow.partner_id) {
      return NextResponse.json(
        { error: "해당 거래처 쇼핑몰의 상품만 장바구니에 담을 수 있습니다." },
        { status: 400 }
      );
    }

    if (productRow.status !== "active") {
      return NextResponse.json(
        { error: "판매 중인 상품만 장바구니에 담을 수 있습니다." },
        { status: 400 }
      );
    }

    let cart: { id: string } | null = null;
    let sessionIdOut: string | null = null;

    if (session?.user?.id) {
      let { data: c } = await supabase
        .from("carts")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (!c) {
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

        c = newCart;
      }
      cart = c;
    } else {
      let sessionId = request.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
      if (!sessionId || sessionId.length < 8) {
        sessionId = randomUUID();
      }
      sessionIdOut = sessionId;

      let { data: c } = await supabase
        .from("carts")
        .select("*")
        .eq("session_id", sessionId)
        .eq("client_id", clientId)
        .maybeSingle();

      if (!c) {
        const { data: newCart, error: createError } = await supabase
          .from("carts")
          .insert({
            session_id: sessionId,
            client_id: clientId,
            user_id: null,
          })
          .select()
          .single();

        if (createError) {
          return NextResponse.json({ error: "장바구니 생성 실패" }, { status: 500 });
        }

        c = newCart;
      }
      cart = c;
    }

    const { data: existingItems } = await supabase
      .from("cart_items")
      .select("*")
      .eq("cart_id", cart!.id)
      .eq("product_id", productId);

    const existingItem = (existingItems || []).find((item: { option_json: object | null }) => {
      if (!optionJson && !item.option_json) return true;
      return JSON.stringify(item.option_json) === JSON.stringify(optionJson);
    });

    if (existingItem) {
      const { data: updated, error: updateError } = await supabase
        .from("cart_items")
        .update({ quantity: existingItem.quantity + quantity })
        .eq("id", existingItem.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: "장바구니 업데이트 실패" }, { status: 500 });
      }

      const res = NextResponse.json({ cartItem: updated, message: "장바구니에 추가되었습니다." });
      if (sessionIdOut) appendCartCookie(res, sessionIdOut);
      return res;
    }

    const { data: newItem, error: insertError } = await supabase
      .from("cart_items")
      .insert({
        cart_id: cart!.id,
        product_id: productId,
        option_json: optionJson || null,
        quantity,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: "장바구니 추가 실패" }, { status: 500 });
    }

    const res = NextResponse.json({ cartItem: newItem, message: "장바구니에 추가되었습니다." });
    if (sessionIdOut) appendCartCookie(res, sessionIdOut);
    return res;
  } catch (err) {
    console.error("Cart POST API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

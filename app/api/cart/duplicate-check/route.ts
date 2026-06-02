import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { userBelongsToClient } from "@/lib/mypage-client-access";
import { randomUUID } from "crypto";
import {
  CART_SESSION_COOKIE,
  GUEST_CART_SESSION_MAX_AGE,
} from "@/lib/cart-session-cookie";
import { findMatchingCartItem } from "@/lib/cart-item-option-match";
import { purgeStaleGuestCartItems } from "@/lib/guest-cart-stale";

function appendGuestCartCookie(res: NextResponse, sessionId: string) {
  res.cookies.set(CART_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_CART_SESSION_MAX_AGE,
  });
}

function parseOptionJsonParam(raw: string | null): object | null | "invalid" {
  if (raw == null || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null) return null;
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as object;
    }
    return "invalid";
  } catch {
    return "invalid";
  }
}

/**
 * GET /api/cart/duplicate-check?clientId=&productId=&optionJson=&guestCart=1
 * 동일 SKU(product_id + option_json) 장바구니 존재 여부
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const productId = searchParams.get("productId");
    const guestCart = searchParams.get("guestCart") === "1";
    const optionParsed = parseOptionJsonParam(searchParams.get("optionJson"));

    if (!clientId || !productId) {
      return NextResponse.json({ error: "clientId와 productId가 필요합니다." }, { status: 400 });
    }
    if (optionParsed === "invalid") {
      return NextResponse.json({ error: "optionJson 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    if (session?.user?.id && !guestCart) {
      const belongs = await userBelongsToClient(supabase, session.user.id, clientId);
      if (!belongs) {
        return NextResponse.json(
          { error: "이 전용몰의 소속 회원만 장바구니를 이용할 수 있습니다." },
          { status: 403 }
        );
      }

      const { data: cart } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (!cart) {
        return NextResponse.json({ exists: false });
      }

      const { data: items } = await supabase
        .from("cart_items")
        .select("id, quantity, option_json")
        .eq("cart_id", cart.id)
        .eq("product_id", productId);

      const match = findMatchingCartItem(items, optionParsed);
      if (!match) {
        return NextResponse.json({ exists: false });
      }

      return NextResponse.json({
        exists: true,
        cartItemId: match.id,
        quantity: match.quantity,
      });
    }

    let sessionId = request.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
    if (!sessionId || sessionId.length < 8) {
      sessionId = randomUUID();
    }

    const { data: cart } = await supabase
      .from("carts")
      .select("id, updated_at")
      .eq("session_id", sessionId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (!cart) {
      const res = NextResponse.json({ exists: false });
      appendGuestCartCookie(res, sessionId);
      return res;
    }

    await purgeStaleGuestCartItems(supabase, cart.id, cart.updated_at);

    const { data: items } = await supabase
      .from("cart_items")
      .select("id, quantity, option_json")
      .eq("cart_id", cart.id)
      .eq("product_id", productId);

    const match = findMatchingCartItem(items, optionParsed);
    const res = NextResponse.json(
      match
        ? { exists: true, cartItemId: match.id, quantity: match.quantity }
        : { exists: false }
    );
    appendGuestCartCookie(res, sessionId);
    return res;
  } catch (err) {
    console.error("Cart duplicate-check API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

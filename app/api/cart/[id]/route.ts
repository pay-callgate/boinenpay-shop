import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { CART_SESSION_COOKIE } from "@/lib/cart-session-cookie";

/**
 * 장바구니 항목 업데이트/삭제
 * - 회원: cart.user_id 일치
 * - 비회원: cart.session_id = 쿠키
 */

async function resolveCartAccess(
  supabase: ReturnType<typeof createServerSupabase>,
  itemId: string,
  userId: string | undefined,
  sessionIdFromCookie: string | null
) {
  const { data: item } = await supabase
    .from("cart_items")
    .select("*, cart:carts!inner(id, user_id, session_id)")
    .eq("id", itemId)
    .single();

  if (!item?.cart) return { ok: false as const, item: null };

  const cart = item.cart as { id: string; user_id: string | null; session_id: string | null };

  if (userId) {
    if (cart.user_id === userId) return { ok: true as const, item };
    return { ok: false as const, item: null };
  }

  if (sessionIdFromCookie && cart.session_id === sessionIdFromCookie && !cart.user_id) {
    return { ok: true as const, item };
  }

  return { ok: false as const, item: null };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const body = await request.json();
    const { quantity, optionJson } = body;

    const supabase = createServerSupabase();
    const sid = request.cookies.get(CART_SESSION_COOKIE)?.value ?? null;

    const { ok } = await resolveCartAccess(
      supabase,
      id,
      session?.user?.id,
      sid
    );

    if (!ok) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const updates: { quantity?: number; option_json?: object | null } = {};
    if (quantity !== undefined) updates.quantity = quantity;
    if (optionJson !== undefined) updates.option_json = optionJson;

    const { data: updated, error } = await supabase
      .from("cart_items")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
    }

    return NextResponse.json({ cartItem: updated });
  } catch (err) {
    console.error("Cart item PUT API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const supabase = createServerSupabase();
    const sid = request.cookies.get(CART_SESSION_COOKIE)?.value ?? null;

    const { ok } = await resolveCartAccess(
      supabase,
      id,
      session?.user?.id,
      sid
    );

    if (!ok) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { error } = await supabase.from("cart_items").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }

    return NextResponse.json({ message: "삭제되었습니다." });
  } catch (err) {
    console.error("Cart item DELETE API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

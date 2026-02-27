import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T4-4: 장바구니 항목 업데이트/삭제 API
 * PUT /api/cart/[id] (수량 또는 옵션 변경)
 * DELETE /api/cart/[id] (항목 삭제)
 */

export async function PUT(
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
    const { quantity, optionJson } = body;

    const supabase = createServerSupabase();

    // 항목이 사용자의 것인지 확인
    const { data: item } = await supabase
      .from("cart_items")
      .select("*, cart:carts!inner(user_id)")
      .eq("id", id)
      .single();

    if (!item || item.cart.user_id !== session.user.id) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    // 업데이트
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerSupabase();

    // 항목이 사용자의 것인지 확인
    const { data: item } = await supabase
      .from("cart_items")
      .select("*, cart:carts!inner(user_id)")
      .eq("id", id)
      .single();

    if (!item || item.cart.user_id !== session.user.id) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    // 삭제
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

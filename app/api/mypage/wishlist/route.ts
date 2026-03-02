import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T6-5: 관심상품(Wishlist) API
 * GET /api/mypage/wishlist - 관심상품 목록
 * POST /api/mypage/wishlist - 관심상품 추가
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
      return NextResponse.json({ error: "거래처 정보가 필요합니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data: wishlistItems, error } = await supabase
      .from("wishlist_items")
      .select(
        `
        id,
        created_at,
        product:products (
          id,
          name,
          slug,
          base_price,
          sale_price,
          thumbnail_url,
          status
        )
      `
      )
      .eq("user_id", session.user.id)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Wishlist fetch error:", error);
      return NextResponse.json({ error: "관심상품 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({ items: wishlistItems || [] });
  } catch (err) {
    console.error("Wishlist GET API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { productId, clientId } = await request.json();

    if (!productId || !clientId) {
      return NextResponse.json(
        { error: "상품 정보와 거래처 정보가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 이미 등록된 관심상품인지 확인
    const { data: existing } = await supabase
      .from("wishlist_items")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("product_id", productId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: "이미 관심상품에 등록되어 있습니다." });
    }

    // 관심상품 추가
    const { error } = await supabase.from("wishlist_items").insert({
      user_id: session.user.id,
      product_id: productId,
      client_id: clientId,
    });

    if (error) {
      console.error("Wishlist insert error:", error);
      return NextResponse.json({ error: "관심상품 추가 실패" }, { status: 500 });
    }

    return NextResponse.json({ message: "관심상품에 추가되었습니다." });
  } catch (err) {
    console.error("Wishlist POST API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

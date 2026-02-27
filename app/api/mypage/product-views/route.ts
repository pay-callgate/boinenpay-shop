import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T8-1: 최근 본 상품 추적 API
 * POST /api/mypage/product-views - 상품 조회 기록 저장
 * GET /api/mypage/product-views - 최근 본 상품 목록 조회
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId가 필요합니다. (거래처 단위 조회)" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    let query = supabase
      .from("product_views")
      .select(
        `
        id,
        viewed_at,
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
      .order("viewed_at", { ascending: false })
      .limit(limit);

    const { data: views, error } = await query;

    if (error) {
      console.error("Product views fetch error:", error);
      return NextResponse.json({ error: "조회 이력을 불러올 수 없습니다." }, { status: 500 });
    }

    // 중복 제거 (같은 상품을 여러 번 본 경우 최신 것만)
    const uniqueProducts = new Map();
    (views || []).forEach((view: any) => {
      if (view.product && !uniqueProducts.has(view.product.id)) {
        uniqueProducts.set(view.product.id, view);
      }
    });

    return NextResponse.json({
      views: Array.from(uniqueProducts.values()),
    });
  } catch (err) {
    console.error("Product views GET API error:", err);
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

    // 최근 본 상품 기록 추가
    const { error } = await supabase.from("product_views").insert({
      user_id: session.user.id,
      product_id: productId,
      client_id: clientId,
      viewed_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Product view insert error:", error);
      // 에러가 발생해도 사용자에게는 영향 없음 (조용히 실패)
      return NextResponse.json({ message: "조회 기록 저장 실패 (무시)" });
    }

    return NextResponse.json({ message: "조회 기록이 저장되었습니다." });
  } catch (err) {
    console.error("Product views POST API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  SHOP_LIST_PRODUCT_STATUS,
  SHOP_PRODUCT_DETAIL_ALLOWED_STATUSES,
} from "@/lib/shop-product-visibility";

/**
 * T4-1: 거래처 쇼핑몰 상품 조회 API
 * GET /api/shop/products?partnerId=xxx&categoryId=xxx&search=xxx&limit=4
 * - 파트너의 상품 조회 (쇼핑몰용)
 * - 카테고리별 필터링, 상품명/슬러그 검색 지원
 * - 기본: 판매중(active)만. includeSoldOut=true 시 품절(sold_out) 포함. 임시저장(draft)은 제외.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");
    const categoryId = searchParams.get("categoryId");
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const includeSoldOut = searchParams.get("includeSoldOut") === "true";

    if (!partnerId) {
      return NextResponse.json(
        { error: "partnerId가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 기본 쿼리
    let query = supabase
      .from("products")
      .select(
        `
        *,
        product_category_mappings!inner (
          category:product_categories (
            id,
            name,
            slug
          )
        )
      `,
        { count: "exact" }
      )
      .eq("partner_id", partnerId);

    // 목록은 판매중만; includeSoldOut 시 판매중+품절(임시저장·기타 상태 제외)
    if (includeSoldOut) {
      query = query.in("status", [...SHOP_PRODUCT_DETAIL_ALLOWED_STATUSES]);
    } else {
      query = query.eq("status", SHOP_LIST_PRODUCT_STATUS);
    }

    // 카테고리 필터
    if (categoryId) {
      query = query.eq("product_category_mappings.category_id", categoryId);
    }

    // 상품명/슬러그 검색
    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    // 정렬 및 페이지네이션
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: products, error, count } = await query;

    if (error) {
      console.error("Shop products fetch error:", error);
      return NextResponse.json(
        { error: "상품 조회 실패" },
        { status: 500 }
      );
    }

    // 카테고리 정보 평탄화
    const formattedProducts = (products || []).map((p) => ({
      ...p,
      categories: p.product_category_mappings?.map(
        (m: { category: { id: string; name: string; slug: string } }) => m.category
      ) || [],
    }));

    return NextResponse.json({
      products: formattedProducts,
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("Shop products API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

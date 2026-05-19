import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  SHOP_LIST_MIN_STOCK_QTY,
  SHOP_LIST_PRODUCT_STATUS,
} from "@/lib/shop-product-visibility";

/**
 * T4-1: 거래처 쇼핑몰 카테고리 조회 API
 * GET /api/shop/categories?partnerId=xxx
 * - 파트너의 카테고리 목록 조회 (쇼핑몰용)
 * - 상품이 있는 카테고리만 반환 옵션
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");
    const onlyWithProducts = searchParams.get("onlyWithProducts") === "true";

    if (!partnerId) {
      return NextResponse.json(
        { error: "partnerId가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 카테고리 조회
    const { data: categories, error } = await supabase
      .from("product_categories")
      .select("*")
      .eq("partner_id", partnerId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Shop categories fetch error:", error);
      return NextResponse.json(
        { error: "카테고리 조회 실패" },
        { status: 500 }
      );
    }

    let result = categories || [];

    /** 쇼핑몰 메뉴용: 부모가 필터에서 빠진 경우 트리 깨짐 방지 */
    function normalizeStorefrontParents(
      rows: typeof result
    ): typeof result {
      const ids = new Set((rows || []).map((c) => c.id));
      return (rows || []).map((c) => ({
        ...c,
        parent_id:
          c.parent_id && ids.has(c.parent_id) ? c.parent_id : null,
      }));
    }

    // 상품이 있는 카테고리만 필터링 (메뉴 트리 구성을 위해 해당 카테고리의 모든 상위 부모도 포함)
    if (onlyWithProducts && result.length > 0) {
      const categoryIds = result.map((c) => c.id);

      // 각 카테고리별 상품 수 조회
      const { data: mappings } = await supabase
        .from("product_category_mappings")
        .select("category_id, products!inner(id, status, stock_qty)")
        .in("category_id", categoryIds)
        .eq("products.status", SHOP_LIST_PRODUCT_STATUS)
        .gte("products.stock_qty", SHOP_LIST_MIN_STOCK_QTY);

      // 상품이 있는 카테고리 ID 집합
      const categoriesWithProducts = new Set(
        (mappings || []).map((m: { category_id: string }) => m.category_id)
      );

      // 상품 있는 카테고리 + 그 부모(조상) 전부 포함 → 사이드바에서 "꽃다발|꽃바구니" 같은 부모 노출 가능
      const includeIds = new Set<string>(categoriesWithProducts);
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of result) {
          if (c.parent_id && includeIds.has(c.id) && !includeIds.has(c.parent_id)) {
            includeIds.add(c.parent_id);
            changed = true;
          }
        }
      }
      // 원본 전체 목록(categories)에서 includeIds에 있는 것만 반환 (부모 포함)
      result = (categories || []).filter((c) => includeIds.has(c.id));
    }

    // 모바일 노출 OFF(admin mobile_visible=false) 카테고리는 쇼핑몰 메뉴에서 제외
    result = result.filter(
      (c: { mobile_visible?: boolean | null }) =>
        c.mobile_visible !== false
    );
    result = normalizeStorefrontParents(result);

    return NextResponse.json({ categories: result });
  } catch (err) {
    console.error("Shop categories API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

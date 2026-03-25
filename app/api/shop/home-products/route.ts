import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 홈 전용: 카테고리 + 카테고리별 상품(각 limit)을 한 번에 반환.
 * GET /api/shop/home-products?partnerId=xxx
 * - 기존 categories + products N회 호출을 1회로 축소해 홈 로딩 속도 개선.
 */
const HOME_PRODUCTS_PER_CATEGORY = 4;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");

    if (!partnerId) {
      return NextResponse.json(
        { error: "partnerId가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 1) 카테고리 조회 (기존 /api/shop/categories와 동일 로직, onlyWithProducts=false)
    const { data: categories, error: catError } = await supabase
      .from("product_categories")
      .select("*")
      .eq("partner_id", partnerId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (catError) {
      console.error("[home-products] categories error:", catError);
      return NextResponse.json(
        { error: "카테고리 조회 실패" },
        { status: 500 }
      );
    }

    let catList = categories || [];

    /** /api/shop/categories와 동일: 모바일 비노출 제외 + 부모 참조 정규화 */
    function normalizeStorefrontParents<T extends { id: string; parent_id: string | null }>(
      rows: T[]
    ): T[] {
      const ids = new Set(rows.map((c) => c.id));
      return rows.map((c) => ({
        ...c,
        parent_id: c.parent_id && ids.has(c.parent_id) ? c.parent_id : null,
      }));
    }
    catList = catList.filter(
      (c: { mobile_visible?: boolean | null }) => c.mobile_visible !== false
    );
    catList = normalizeStorefrontParents(catList as { id: string; parent_id: string | null }[]);

    const productsByCategory: Record<string, unknown[]> = {};

    // 2) 카테고리별 상품 조회 (기존 /api/shop/products와 동일 쿼리, limit=4)
    await Promise.all(
      catList.map(async (cat: { id: string }) => {
        const { data: products, error: prodError } = await supabase
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
          `
          )
          .eq("partner_id", partnerId)
          .neq("status", "sold_out")
          .eq("product_category_mappings.category_id", cat.id)
          .order("created_at", { ascending: false })
          .range(0, HOME_PRODUCTS_PER_CATEGORY - 1);

        if (prodError) {
          console.error("[home-products] products for category", cat.id, prodError);
          productsByCategory[cat.id] = [];
          return;
        }

        const formatted = (products || []).map((p: { product_category_mappings?: { category: { id: string; name: string; slug: string } }[] }) => ({
          ...p,
          categories:
            p.product_category_mappings?.map((m: { category: { id: string; name: string; slug: string } }) => m.category) ?? [],
        }));
        productsByCategory[cat.id] = formatted;
      })
    );

    return NextResponse.json({
      categories: catList,
      productsByCategory,
    });
  } catch (err) {
    console.error("[home-products] error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

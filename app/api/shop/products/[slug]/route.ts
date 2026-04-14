import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { SHOP_PRODUCT_DETAIL_ALLOWED_STATUSES } from "@/lib/shop-product-visibility";

/**
 * T4-3: 상품 상세 조회 API
 * GET /api/shop/products/[slug]?partnerId=xxx
 * - 상품 상세 정보 조회 (쇼핑몰용)
 * - 판매중·품절만 조회 가능. 임시저장(draft) 등은 404.
 * - 옵션, 갤러리 이미지 포함
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");

    if (!partnerId) {
      return NextResponse.json(
        { error: "partnerId가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 상품 기본 정보 조회
    const { data: product, error } = await supabase
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
      .eq("slug", slug)
      .in("status", [...SHOP_PRODUCT_DETAIL_ALLOWED_STATUSES])
      .single();

    if (error || !product) {
      return NextResponse.json(
        { error: "상품을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 옵션 조회
    const { data: options } = await supabase
      .from("product_options")
      .select("*")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true });

    // 갤러리 이미지 조회
    const { data: gallery } = await supabase
      .from("product_gallery")
      .select("*")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true });

    // 카테고리 정보 평탄화
    const categories = product.product_category_mappings?.map(
      (m: { category: { id: string; name: string; slug: string } }) => m.category
    ) || [];

    return NextResponse.json({
      product: {
        ...product,
        categories,
        options: options || [],
        gallery: gallery || [],
      },
    });
  } catch (err) {
    console.error("Shop product detail API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

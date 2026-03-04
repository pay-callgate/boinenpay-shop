import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T2-2, T2-3: 상품 API
 * GET /api/products?partnerId=xxx&page=1&limit=20&search=xxx&categoryId=xxx&status=xxx
 * POST /api/products - 상품 생성
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 상품 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const status = searchParams.get("status") || "";

    if (!partnerId) {
      console.log("[API /api/products] 400 - partnerId 없음");
      return NextResponse.json(
        { error: "partnerId가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 카테고리 필터: DB에서 해당 카테고리 상품 ID 목록 조회 후 쿼리에 반영 (count/목록 일치)
    let productIdsInCategory: string[] | null = null;
    if (categoryId) {
      const { data: mappings } = await supabase
        .from("product_category_mappings")
        .select("product_id")
        .eq("category_id", categoryId);
      productIdsInCategory = (mappings ?? []).map((m: { product_id: string }) => m.product_id);
      if (productIdsInCategory.length === 0) {
        return NextResponse.json({
          products: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
    }

    let query = supabase
      .from("products")
      .select(
        `
        *,
        product_category_mappings(
          category_id,
          product_categories(id, name)
        )
      `,
        { count: "exact" }
      )
      .eq("partner_id", partnerId);

    if (productIdsInCategory) {
      query = query.in("id", productIdsInCategory);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq("status", status);
    }

    // 정렬을 .range() 이전에 명시적으로 적용 (페이징 시 누락/중복 방지)
    query = query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    const { data: products, error, count } = await query;

    if (error) {
      console.error("Products fetch error:", error);
      return NextResponse.json(
        { error: "상품 조회 실패" },
        { status: 500 }
      );
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);
    console.log("[API /api/products] GET", { partnerId, total, page, limit });

    return NextResponse.json({
      products: products ?? [],
      pagination: {
        page,
        limit,
        total,
        totalPages: totalPages < 1 ? 1 : totalPages,
      },
    });
  } catch (err) {
    console.error("Products API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 상품 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      partnerId,
      name,
      slug,
      shortDescription,
      descriptionHtml,
      thumbnailUrl,
      basePrice,
      salePrice,
      stockQty,
      safetyStock,
      status,
      stickerOptions,
      deliveryMethods,
      allowDeliveryDate,
      categoryIds,
    } = body;

    if (!partnerId || !name) {
      return NextResponse.json(
        { error: "partnerId와 name은 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // slug 생성
    const productSlug =
      slug ||
      name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-가-힣]/g, "");

    // 중복 검사
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("partner_id", partnerId)
      .eq("slug", productSlug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "동일한 slug가 이미 존재합니다." },
        { status: 409 }
      );
    }

    // 상품 생성
    const { data: product, error } = await supabase
      .from("products")
      .insert({
        partner_id: partnerId,
        name,
        slug: productSlug,
        short_description: shortDescription || null,
        description_html: descriptionHtml || null,
        thumbnail_url: thumbnailUrl || null,
        base_price: basePrice || 0,
        sale_price: salePrice || null,
        stock_qty: stockQty ?? 0,
        safety_stock: safetyStock ?? 0,
        status: status || "draft",
        sticker_options: stickerOptions || null,
        delivery_methods: deliveryMethods || null,
        allow_delivery_date: allowDeliveryDate ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error("Product create error:", error);
      return NextResponse.json(
        { error: "상품 생성 실패" },
        { status: 500 }
      );
    }

    // 카테고리 매핑
    if (categoryIds && categoryIds.length > 0) {
      const mappings = categoryIds.map((catId: string) => ({
        product_id: product.id,
        category_id: catId,
      }));

      const { error: mappingError } = await supabase
        .from("product_category_mappings")
        .insert(mappings);

      if (mappingError) {
        console.error("Category mapping error:", mappingError);
      }
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error("Products POST error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

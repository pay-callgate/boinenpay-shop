import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { logApiRequest } from "@/lib/logger";
import { normalizeDeliveryMethodsForDb } from "@/lib/product-delivery-methods";
import {
  buildProductCategoryMappingRows,
  normalizeCustomPolicyDataPayload,
  parsePolicySource,
} from "@/lib/product-policy-admin";

/**
 * T2-2, T2-3: 상품 API
 * GET /api/products?partnerId=xxx&page=1&limit=20&search=xxx&categoryId=xxx&status=xxx
 * POST /api/products - 상품 생성
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** 상품 관리 목록: 판매중 → 품절 → 임시저장 → 비활성 → 기타 */
const PRODUCT_LIST_STATUS_RANK: Record<string, number> = {
  active: 0,
  sold_out: 1,
  draft: 2,
  inactive: 3,
};

function productListStatusRank(status: string | null | undefined): number {
  if (status == null || status === "") return 999;
  return PRODUCT_LIST_STATUS_RANK[status] ?? 4;
}

function sortProductIdsByAdminListOrder<
  T extends { id: string; status: string | null; created_at: string | null }
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const r = productListStatusRank(a.status) - productListStatusRank(b.status);
    if (r !== 0) return r;
    const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
    const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (cb !== ca) return cb - ca;
    return String(b.id).localeCompare(String(a.id));
  });
}

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

    let listQuery = supabase
      .from("products")
      .select("id, status, created_at", { count: "exact" })
      .eq("partner_id", partnerId);

    if (productIdsInCategory) {
      listQuery = listQuery.in("id", productIdsInCategory);
    }

    if (search) {
      listQuery = listQuery.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    if (status) {
      listQuery = listQuery.eq("status", status);
    }

    const { data: idRows, error: listError, count } = await listQuery;

    if (listError) {
      console.error("Products list id fetch error:", listError);
      return NextResponse.json(
        { error: "상품 조회 실패" },
        { status: 500 }
      );
    }

    const sortedRows = sortProductIdsByAdminListOrder(idRows ?? []);
    const pageSlice = sortedRows.slice(from, from + limit);
    const pageIds = pageSlice.map((r) => r.id);

    let products: unknown[] = [];
    if (pageIds.length > 0) {
      const { data: productsRaw, error: detailError } = await supabase
        .from("products")
        .select(
          `
          *,
          product_category_mappings(
            category_id,
            product_categories(id, name)
          )
        `
        )
        .in("id", pageIds);

      if (detailError) {
        console.error("Products fetch error:", detailError);
        return NextResponse.json(
          { error: "상품 조회 실패" },
          { status: 500 }
        );
      }

      const orderIndex = new Map(pageIds.map((id, i) => [id, i]));
      products = [...(productsRaw ?? [])].sort(
        (a: { id: string }, b: { id: string }) =>
          (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0)
      );
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);
    console.log("[API /api/products] GET", { partnerId, total, page, limit });

    return NextResponse.json({
      products,
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

    logApiRequest("INFO", request, {
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      action: "products_create",
      data: { bodyPreview: await request.clone().json().catch(() => undefined) },
    });

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
      memberPrice,
      stockQty,
      safetyStock,
      status,
      stickerOptions,
      deliveryMethods,
      allowDeliveryDate,
      categoryIds,
      primaryCategoryId,
      policySource,
      overrideTemplateId,
      customPolicyData,
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

    async function assertInfoTemplateOwned(
      templateId: string,
      partnerId: string
    ): Promise<boolean> {
      const { data } = await supabase
        .from("info_templates")
        .select("id")
        .eq("id", templateId)
        .eq("partner_id", partnerId)
        .maybeSingle();
      return Boolean(data);
    }

    const src = parsePolicySource(policySource) ?? "category_default";
    let overrideUuid: string | null = null;
    if (overrideTemplateId != null && overrideTemplateId !== "") {
      const tid = String(overrideTemplateId);
      const ok = await assertInfoTemplateOwned(tid, partnerId);
      if (!ok) {
        return NextResponse.json(
          { error: "overrideTemplateId가 유효하지 않습니다." },
          { status: 400 }
        );
      }
      overrideUuid = tid;
    }
    if (src === "template" && !overrideUuid) {
      return NextResponse.json(
        { error: "정책 소스가 template이면 overrideTemplateId가 필요합니다." },
        { status: 400 }
      );
    }

    let customJson: Record<string, string> | null = null;
    if (src === "custom") {
      const normalized = normalizeCustomPolicyDataPayload(customPolicyData ?? {});
      if (!normalized) {
        return NextResponse.json(
          { error: "customPolicyData 형식이 올바르지 않습니다." },
          { status: 400 }
        );
      }
      customJson = normalized;
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
        member_price: memberPrice != null ? memberPrice : null,
        stock_qty: stockQty ?? 0,
        safety_stock: safetyStock ?? 0,
        status: status || "draft",
        sticker_options: stickerOptions || null,
        delivery_methods: normalizeDeliveryMethodsForDb(deliveryMethods),
        allow_delivery_date: allowDeliveryDate ?? false,
        policy_source: src,
        override_template_id: src === "template" ? overrideUuid : null,
        custom_policy_data: src === "custom" ? customJson : null,
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
      const mappings = buildProductCategoryMappingRows(
        product.id,
        categoryIds as string[],
        primaryCategoryId as string | null | undefined
      );

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

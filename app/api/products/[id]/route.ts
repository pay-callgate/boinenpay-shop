import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeDeliveryMethodsForDb } from "@/lib/product-delivery-methods";
import {
  buildProductCategoryMappingRows,
  normalizeCustomPolicyDataPayload,
  parsePolicySource,
} from "@/lib/product-policy-admin";

/**
 * T2-3: 상품 상세 API
 * GET /api/products/[id] - 단일 상품 조회
 * PUT /api/products/[id] - 상품 수정
 * DELETE /api/products/[id] - 상품 삭제
 */

// GET: 단일 상품 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerSupabase();

    const { data: product, error } = await supabase
      .from("products")
      .select(
        `
        *,
        product_category_mappings(
          category_id,
          is_primary,
          product_categories(id, name)
        ),
        product_images(id, url, sort_order),
        product_options(id, name, value, price_adjustment, sort_order)
      `
      )
      .eq("id", id)
      .single();

    if (error || !product) {
      return NextResponse.json(
        { error: "상품을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ product });
  } catch (err) {
    console.error("Product GET error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 상품 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
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
      /** T3.4: 뉴런 상품·옵션 기본 draft (`null`이면 비움) */
      newrunDefaultProductDraft,
      newrunDefaultOptionDraft,
    } = body;

    const supabase = createServerSupabase();

    // 기존 상품 확인
    const { data: existing } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "상품을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // slug 중복 검사 (자기 자신 제외)
    if (slug && slug !== existing.slug) {
      const { data: duplicateSlug } = await supabase
        .from("products")
        .select("id")
        .eq("partner_id", existing.partner_id)
        .eq("slug", slug)
        .neq("id", id)
        .maybeSingle();

      if (duplicateSlug) {
        return NextResponse.json(
          { error: "동일한 slug가 이미 존재합니다." },
          { status: 409 }
        );
      }
    }

    // 업데이트할 필드만 추출
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (shortDescription !== undefined) updateData.short_description = shortDescription;
    if (descriptionHtml !== undefined) updateData.description_html = descriptionHtml;
    if (thumbnailUrl !== undefined) updateData.thumbnail_url = thumbnailUrl;
    if (basePrice !== undefined) updateData.base_price = basePrice;
    if (salePrice !== undefined) updateData.sale_price = salePrice;
    if (memberPrice !== undefined) updateData.member_price = memberPrice;
    if (stockQty !== undefined) updateData.stock_qty = stockQty;
    if (safetyStock !== undefined) updateData.safety_stock = safetyStock;
    if (status !== undefined) updateData.status = status;
    // 재고 등록/수정 시: 재고가 0 이상이면 품절(sold_out) → 판매중(active) 자동 전환 (상품 수정 페이지·재고 관리 페이지 공통)
    if (stockQty !== undefined && Number(stockQty) >= 0 && existing.status === "sold_out") {
      updateData.status = "active";
    }
    if (stickerOptions !== undefined) updateData.sticker_options = stickerOptions;
    if (deliveryMethods !== undefined) {
      updateData.delivery_methods = normalizeDeliveryMethodsForDb(deliveryMethods);
    }
    if (allowDeliveryDate !== undefined) updateData.allow_delivery_date = allowDeliveryDate;

    const assertDraft = (v: unknown): boolean =>
      v === null || (typeof v === "object" && !Array.isArray(v));
    if (newrunDefaultProductDraft !== undefined) {
      if (!assertDraft(newrunDefaultProductDraft)) {
        return NextResponse.json(
          { error: "newrunDefaultProductDraft는 객체 또는 null이어야 합니다." },
          { status: 400 }
        );
      }
      updateData.newrun_default_product_draft = newrunDefaultProductDraft;
    }
    if (newrunDefaultOptionDraft !== undefined) {
      if (!assertDraft(newrunDefaultOptionDraft)) {
        return NextResponse.json(
          { error: "newrunDefaultOptionDraft는 객체 또는 null이어야 합니다." },
          { status: 400 }
        );
      }
      updateData.newrun_default_option_draft = newrunDefaultOptionDraft;
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

    if (policySource !== undefined) {
      const parsed = parsePolicySource(policySource);
      if (!parsed) {
        return NextResponse.json(
          {
            error:
              "policySource는 category_default, template, custom 중 하나여야 합니다.",
          },
          { status: 400 }
        );
      }
      updateData.policy_source = parsed;
    }

    if (overrideTemplateId !== undefined) {
      if (overrideTemplateId === null || overrideTemplateId === "") {
        updateData.override_template_id = null;
      } else {
        const tid = String(overrideTemplateId);
        const ok = await assertInfoTemplateOwned(tid, existing.partner_id as string);
        if (!ok) {
          return NextResponse.json(
            { error: "overrideTemplateId가 유효하지 않습니다." },
            { status: 400 }
          );
        }
        updateData.override_template_id = tid;
      }
    }

    if (customPolicyData !== undefined) {
      if (customPolicyData === null) {
        updateData.custom_policy_data = null;
      } else {
        const normalized = normalizeCustomPolicyDataPayload(customPolicyData);
        if (!normalized) {
          return NextResponse.json(
            {
              error:
                "customPolicyData는 객체(문자열 키 delivery_info, refund_policy, product_notice)여야 합니다.",
            },
            { status: 400 }
          );
        }
        updateData.custom_policy_data = normalized;
      }
    }

    const existingPol = existing as {
      policy_source?: string | null;
      override_template_id?: string | null;
    };
    const mergedSource =
      (updateData.policy_source as string | undefined) ??
      (existingPol.policy_source || "category_default");
    const mergedOverride =
      updateData.override_template_id !== undefined
        ? updateData.override_template_id
        : (existingPol.override_template_id ?? null);

    if (mergedSource === "template" && !mergedOverride) {
      return NextResponse.json(
        {
          error: "정책 소스가 template이면 유효한 overrideTemplateId가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const { data: product, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Product update error:", error);
      return NextResponse.json(
        { error: "상품 수정 실패" },
        { status: 500 }
      );
    }

    // 카테고리 매핑 업데이트
    if (categoryIds !== undefined) {
      // 기존 매핑 삭제
      await supabase
        .from("product_category_mappings")
        .delete()
        .eq("product_id", id);

      // 새 매핑 추가
      if (categoryIds.length > 0) {
        const mappings = buildProductCategoryMappingRows(
          id,
          categoryIds as string[],
          primaryCategoryId as string | null | undefined
        );

        await supabase.from("product_category_mappings").insert(mappings);
      }
    }

    return NextResponse.json({ product });
  } catch (err) {
    console.error("Product PUT error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 상품 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerSupabase();

    // 주문 내역 확인
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id")
      .eq("product_id", id)
      .limit(1);

    if (orderItems && orderItems.length > 0) {
      return NextResponse.json(
        { error: "주문 내역이 있는 상품은 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    // 카테고리 매핑 삭제
    await supabase
      .from("product_category_mappings")
      .delete()
      .eq("product_id", id);

    // 상품 이미지 삭제
    await supabase.from("product_images").delete().eq("product_id", id);

    // 상품 옵션 삭제
    await supabase.from("product_options").delete().eq("product_id", id);

    // 상품 삭제
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("Product delete error:", error);
      return NextResponse.json(
        { error: "상품 삭제 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Product DELETE error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T2-1: 카테고리 API
 * GET /api/categories?partnerId=xxx - 카테고리 목록 조회
 * POST /api/categories - 카테고리 생성
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: 카테고리 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");

    if (!partnerId) {
      console.log("[API /api/categories] 400 - partnerId 없음");
      return NextResponse.json(
        { error: "partnerId가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: categories, error } = await supabase
      .from("product_categories")
      .select("*")
      .eq("partner_id", partnerId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Categories fetch error:", error);
      return NextResponse.json(
        { error: "카테고리 조회 실패" },
        { status: 500 }
      );
    }

    // 계층 구조로 변환
    const rootCategories = categories?.filter((c) => !c.parent_id) || [];
    const childCategories = categories?.filter((c) => c.parent_id) || [];

    const hierarchical = rootCategories.map((root) => ({
      ...root,
      children: childCategories.filter((c) => c.parent_id === root.id),
    }));

    const count = categories?.length ?? 0;
    console.log("[API /api/categories] GET", { partnerId, count });
    return NextResponse.json({ categories: hierarchical, flat: categories });
  } catch (err) {
    console.error("Categories API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 카테고리 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { partnerId, name, slug, parentId, sortOrder, mobileVisible, defaultTemplateId } =
      body;

    if (!partnerId || !name) {
      return NextResponse.json(
        { error: "partnerId와 name은 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // slug 생성 (입력값 없으면 name 기반)
    const categorySlug =
      slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-가-힣]/g, "");

    // 중복 검사
    const { data: existing } = await supabase
      .from("product_categories")
      .select("id")
      .eq("partner_id", partnerId)
      .eq("slug", categorySlug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "동일한 slug가 이미 존재합니다." },
        { status: 409 }
      );
    }

    let defaultTemplateUuid: string | null = null;
    if (defaultTemplateId != null && defaultTemplateId !== "") {
      const tid = String(defaultTemplateId);
      const { data: tpl } = await supabase
        .from("info_templates")
        .select("id")
        .eq("id", tid)
        .eq("partner_id", partnerId)
        .maybeSingle();
      if (!tpl) {
        return NextResponse.json(
          { error: "선택한 안내 템플릿을 찾을 수 없습니다." },
          { status: 400 }
        );
      }
      defaultTemplateUuid = tid;
    }

    const { data: category, error } = await supabase
      .from("product_categories")
      .insert({
        partner_id: partnerId,
        name,
        slug: categorySlug,
        parent_id: parentId || null,
        sort_order: sortOrder ?? 0,
        mobile_visible:
          typeof mobileVisible === "boolean" ? mobileVisible : true,
        default_template_id: defaultTemplateUuid,
      })
      .select()
      .single();

    if (error) {
      console.error("Category create error:", error);
      return NextResponse.json(
        { error: "카테고리 생성 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    console.error("Categories POST error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

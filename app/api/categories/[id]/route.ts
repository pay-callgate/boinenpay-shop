import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T2-1: 카테고리 상세 API
 * GET /api/categories/[id] - 단일 카테고리 조회
 * PUT /api/categories/[id] - 카테고리 수정
 * DELETE /api/categories/[id] - 카테고리 삭제
 */

// GET: 단일 카테고리 조회
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

    const { data: category, error } = await supabase
      .from("product_categories")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !category) {
      return NextResponse.json(
        { error: "카테고리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ category });
  } catch (err) {
    console.error("Category GET error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 카테고리 수정
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
    const { name, slug, parentId, sortOrder, mobileVisible, showPreferredTime, defaultTemplateId } =
      body;

    const supabase = createServerSupabase();

    // 기존 카테고리 확인
    const { data: existing } = await supabase
      .from("product_categories")
      .select("*")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "카테고리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // slug 중복 검사 (자기 자신 제외)
    if (slug && slug !== existing.slug) {
      const { data: duplicateSlug } = await supabase
        .from("product_categories")
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

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (parentId !== undefined) updateData.parent_id = parentId || null;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;
    if (typeof mobileVisible === "boolean")
      updateData.mobile_visible = mobileVisible;
    if (typeof showPreferredTime === "boolean")
      updateData.show_preferred_time = showPreferredTime;

    if (defaultTemplateId !== undefined) {
      if (defaultTemplateId === null || defaultTemplateId === "") {
        updateData.default_template_id = null;
      } else {
        const tid = String(defaultTemplateId);
        const { data: tpl } = await supabase
          .from("info_templates")
          .select("id")
          .eq("id", tid)
          .eq("partner_id", existing.partner_id as string)
          .maybeSingle();
        if (!tpl) {
          return NextResponse.json(
            { error: "선택한 안내 템플릿을 찾을 수 없습니다." },
            { status: 400 }
          );
        }
        updateData.default_template_id = tid;
      }
    }

    const { data: category, error } = await supabase
      .from("product_categories")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Category update error:", error);
      return NextResponse.json(
        { error: "카테고리 수정 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({ category });
  } catch (err) {
    console.error("Category PUT error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 카테고리 삭제
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

    // 하위 카테고리 존재 여부 확인
    const { data: children } = await supabase
      .from("product_categories")
      .select("id")
      .eq("parent_id", id);

    if (children && children.length > 0) {
      return NextResponse.json(
        { error: "하위 카테고리가 있어 삭제할 수 없습니다. 먼저 하위 카테고리를 삭제해주세요." },
        { status: 400 }
      );
    }

    // 연결된 상품 여부 확인
    const { data: mappings } = await supabase
      .from("product_category_mappings")
      .select("product_id")
      .eq("category_id", id);

    if (mappings && mappings.length > 0) {
      return NextResponse.json(
        { error: "해당 카테고리에 연결된 상품이 있어 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("product_categories")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Category delete error:", error);
      return NextResponse.json(
        { error: "카테고리 삭제 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Category DELETE error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

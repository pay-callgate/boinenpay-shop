import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { requirePartnerAccess } from "@/lib/partner-admin-guard";

/**
 * GET /api/info-templates/[id] — 단일 조회
 * PUT /api/info-templates/[id] — 수정
 * DELETE /api/info-templates/[id] — 삭제
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerSupabase();

    const { data: row, error } = await supabase
      .from("info_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: "템플릿을 찾을 수 없습니다." }, { status: 404 });
    }

    const auth = await requirePartnerAccess(
      supabase,
      session.user.id,
      row.partner_id as string
    );
    if (!auth.ok) return auth.response;

    return NextResponse.json({ template: row });
  } catch (err) {
    console.error("[info-templates/[id]] GET:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createServerSupabase();

    const { data: existing, error: fetchErr } = await supabase
      .from("info_templates")
      .select("id, partner_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "템플릿을 찾을 수 없습니다." }, { status: 404 });
    }

    const auth = await requirePartnerAccess(
      supabase,
      session.user.id,
      existing.partner_id as string
    );
    if (!auth.ok) return auth.response;

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.name === "string") update.name = body.name.trim();
    if (typeof body.deliveryInfo === "string") update.delivery_info = body.deliveryInfo;
    if (typeof body.refundPolicy === "string") update.refund_policy = body.refundPolicy;
    if (typeof body.productNotice === "string") update.product_notice = body.productNotice;

    const { data: row, error } = await supabase
      .from("info_templates")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[info-templates/[id]] update:", error);
      return NextResponse.json({ error: "템플릿 수정 실패" }, { status: 500 });
    }

    return NextResponse.json({ template: row });
  } catch (err) {
    console.error("[info-templates/[id]] PUT:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerSupabase();

    const { data: existing, error: fetchErr } = await supabase
      .from("info_templates")
      .select("id, partner_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "템플릿을 찾을 수 없습니다." }, { status: 404 });
    }

    const auth = await requirePartnerAccess(
      supabase,
      session.user.id,
      existing.partner_id as string
    );
    if (!auth.ok) return auth.response;

    const { error } = await supabase.from("info_templates").delete().eq("id", id);

    if (error) {
      console.error("[info-templates/[id]] delete:", error);
      return NextResponse.json({ error: "템플릿 삭제 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[info-templates/[id]] DELETE:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

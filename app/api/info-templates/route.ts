import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { requirePartnerAccess } from "@/lib/partner-admin-guard";

/**
 * GET /api/info-templates?partnerId=xxx — 파트너 안내 템플릿 목록
 * POST /api/info-templates — 템플릿 생성
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");
    if (!partnerId) {
      return NextResponse.json({ error: "partnerId가 필요합니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const auth = await requirePartnerAccess(supabase, session.user.id, partnerId);
    if (!auth.ok) return auth.response;

    const { data: templates, error } = await supabase
      .from("info_templates")
      .select("id, partner_id, name, delivery_info, refund_policy, product_notice, created_at, updated_at")
      .eq("partner_id", partnerId)
      .order("name", { ascending: true });

    if (error) {
      console.error("[info-templates] list error:", error);
      return NextResponse.json({ error: "템플릿 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({ templates: templates ?? [] });
  } catch (err) {
    console.error("[info-templates] GET:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const partnerId = body.partnerId as string | undefined;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const deliveryInfo = typeof body.deliveryInfo === "string" ? body.deliveryInfo : "";
    const refundPolicy = typeof body.refundPolicy === "string" ? body.refundPolicy : "";
    const productNotice = typeof body.productNotice === "string" ? body.productNotice : "";

    if (!partnerId || !name) {
      return NextResponse.json(
        { error: "partnerId와 name(템플릿명)은 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const auth = await requirePartnerAccess(supabase, session.user.id, partnerId);
    if (!auth.ok) return auth.response;

    const { data: row, error } = await supabase
      .from("info_templates")
      .insert({
        partner_id: partnerId,
        name,
        delivery_info: deliveryInfo,
        refund_policy: refundPolicy,
        product_notice: productNotice,
      })
      .select()
      .single();

    if (error) {
      console.error("[info-templates] insert:", error);
      return NextResponse.json({ error: "템플릿 생성 실패" }, { status: 500 });
    }

    return NextResponse.json({ template: row }, { status: 201 });
  } catch (err) {
    console.error("[info-templates] POST:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

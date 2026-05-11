import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { NewrunCallbackKind } from "@/lib/newrun/constants";
import { NEWRUN_CALLBACK_PATHS } from "@/lib/newrun/constants";
import { NEWRUN_ORDER_DRAFT_COLUMNS } from "@/lib/newrun/order-draft-columns";

const VALID_KINDS = new Set<string>(Object.keys(NEWRUN_CALLBACK_PATHS));

function isKind(s: unknown): s is NewrunCallbackKind {
  return typeof s === "string" && VALID_KINDS.has(s);
}

/**
 * 파트너 어드민: 뉴런 협회 검색 선택값을 주문 행에 저장 (T3.3)
 * PATCH /api/partner/orders/[id]/newrun-draft
 * Body: { kind: "florist" | "product" | "option", payload: Record<string, unknown> }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id: orderId } = await params;
    const body = (await request.json()) as { kind?: unknown; payload?: unknown };
    const { kind, payload } = body;

    if (!isKind(kind)) {
      return NextResponse.json({ error: "유효한 kind가 필요합니다." }, { status: 400 });
    }
    const clearing = payload === null;
    if (!clearing && (typeof payload !== "object" || payload === null || Array.isArray(payload))) {
      return NextResponse.json({ error: "payload는 객체이거나 null(초기화)이어야 합니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, partner_id")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError || !order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", order.partner_id)
      .maybeSingle();

    if (!admin) {
      return NextResponse.json({ error: "해당 주문에 대한 수정 권한이 없습니다." }, { status: 403 });
    }

    const column = NEWRUN_ORDER_DRAFT_COLUMNS[kind];
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({
        [column]: clearing ? null : (payload as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select(
        "id, newrun_florist_draft, newrun_product_draft, newrun_option_draft, updated_at"
      )
      .single();

    if (updateError) {
      console.error("[newrun-draft] update failed", updateError);
      return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (err) {
    console.error("Partner newrun-draft PATCH error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

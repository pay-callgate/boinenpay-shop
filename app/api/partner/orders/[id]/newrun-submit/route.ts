import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { submitNewrunOrder } from "@/lib/newrun/submit-order";

/**
 * 파트너 어드민: 뉴런 intranet_post 수동 발주 (Phase 5)
 * POST /api/partner/orders/[id]/newrun-submit
 * Body: { forceRetry?: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id: orderId } = await params;
    const body = (await request.json().catch(() => ({}))) as { forceRetry?: boolean };
    const forceRetry = Boolean(body.forceRetry);

    const supabase = createServerSupabase();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, partner_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", order.partner_id)
      .maybeSingle();

    if (!admin) {
      return NextResponse.json({ error: "해당 주문에 대한 권한이 없습니다." }, { status: 403 });
    }

    const result = await submitNewrunOrder(supabase, orderId, {
      source: "admin_manual",
      forceRetry,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("newrun-submit POST error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

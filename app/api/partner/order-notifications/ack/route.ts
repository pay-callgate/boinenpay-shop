import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { ackAllPartnerNotifyEventsForOrder } from "@/lib/order-partner-notify-events";

/**
 * POST /api/partner/order-notifications/ack
 * Body: { partnerId, orderId }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const partnerId = typeof body.partnerId === "string" ? body.partnerId.trim() : "";
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!partnerId || !orderId) {
      return NextResponse.json({ error: "partnerId, orderId가 필요합니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", partnerId)
      .maybeSingle();

    if (!admin) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id, partner_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order || order.partner_id !== partnerId) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    await ackAllPartnerNotifyEventsForOrder(supabase, {
      partnerId,
      userId: session.user.id,
      orderId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("partner order-notifications ack POST:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

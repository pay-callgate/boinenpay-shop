import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { countUnreadPartnerOrderNotifications } from "@/lib/order-partner-notify-events";

/**
 * GET /api/partner/order-notifications?partnerId=
 * — 현재 사용자·파트너 기준 미확인 주문 알림 건수
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const partnerId = new URL(request.url).searchParams.get("partnerId");
    if (!partnerId) {
      return NextResponse.json({ error: "partnerId가 필요합니다." }, { status: 400 });
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

    const unreadCount = await countUnreadPartnerOrderNotifications(
      supabase,
      partnerId,
      session.user.id
    );

    return NextResponse.json({ success: true, unreadCount });
  } catch (err) {
    console.error("partner order-notifications GET:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

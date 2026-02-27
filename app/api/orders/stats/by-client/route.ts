import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 거래처별 주문·매출 통계 API
 * GET /api/orders/stats/by-client?partnerId=xxx&startDate=xxx&endDate=xxx
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

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
      return NextResponse.json({ error: "해당 파트너 통계 조회 권한이 없습니다." }, { status: 403 });
    }

    let query = supabase
      .from("orders")
      .select("id, client_id, total_amount, payment_status, created_at")
      .eq("partner_id", partnerId);

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data: orders, error } = await query;
    if (error) {
      console.error("Orders by-client stats error:", error);
      return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
    }

    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .eq("partner_id", partnerId);
    const clientMap = new Map((clients || []).map((c) => [c.id, c.name]));

    const byClient: Record<
      string,
      { clientId: string; clientName: string; orderCount: number; revenue: number }
    > = {};

    (orders || []).forEach((order: { client_id: string; total_amount: number; payment_status: string }) => {
      const cid = order.client_id || "_none_";
      if (!byClient[cid]) {
        byClient[cid] = {
          clientId: cid,
          clientName: clientMap.get(cid) || "(미지정)",
          orderCount: 0,
          revenue: 0,
        };
      }
      byClient[cid].orderCount += 1;
      if (order.payment_status === "paid") {
        byClient[cid].revenue += order.total_amount;
      }
    });

    const list = Object.values(byClient).sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({ byClient: list });
  } catch (err) {
    console.error("Orders stats by-client API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

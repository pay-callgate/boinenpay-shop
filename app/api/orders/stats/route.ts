import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T5-4: 주문 통계 API
 * GET /api/orders/stats?partnerId=xxx&startDate=xxx&endDate=xxx
 * - 일별/월별 매출 통계
 * - 상태별 주문 수
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

    // 기본 쿼리
    let query = supabase
      .from("orders")
      .select("id, status, total_amount, created_at, payment_status")
      .eq("partner_id", partnerId);

    // 날짜 필터
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("Orders stats fetch error:", error);
      return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
    }

    // 통계 계산
    const stats = {
      totalOrders: orders?.length || 0,
      totalRevenue: 0,
      byStatus: {} as Record<string, number>,
      byPaymentStatus: {} as Record<string, number>,
      dailyRevenue: {} as Record<string, number>,
    };

    (orders || []).forEach((order: {
      status: string;
      payment_status: string;
      total_amount: number;
      created_at: string;
    }) => {
      // 총 매출 (결제 완료된 주문만)
      if (order.payment_status === "paid") {
        stats.totalRevenue += order.total_amount;
      }

      // 상태별 집계
      stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;

      // 결제 상태별 집계
      stats.byPaymentStatus[order.payment_status] =
        (stats.byPaymentStatus[order.payment_status] || 0) + 1;

      // 일별 매출 (결제 완료된 주문만)
      if (order.payment_status === "paid") {
        const date = order.created_at.split("T")[0];
        stats.dailyRevenue[date] = (stats.dailyRevenue[date] || 0) + order.total_amount;
      }
    });

    return NextResponse.json({ stats });
  } catch (err) {
    console.error("Orders stats API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

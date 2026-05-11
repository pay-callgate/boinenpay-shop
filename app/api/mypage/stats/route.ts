import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { countOrdersByShopFulfillmentStage } from "@/lib/shop/customer-order-fulfillment";

/**
 * T6-1: 마이페이지 통계 API
 * GET /api/mypage/stats?clientId=xxx
 * - 사용자의 주문 현황 통계
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId가 필요합니다. (거래처 단위 통계)" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("status, payment_status")
      .eq("user_id", session.user.id)
      .eq("client_id", clientId)
      .eq("payment_status", "paid");

    if (error) {
      console.error("My stats fetch error:", error);
      return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
    }

    /** 주문 목록(`/api/mypage/orders`)과 동일: 결제 완료 건만, 4단계는 `resolveShopFulfillmentStage` 기준 */
    const stats = countOrdersByShopFulfillmentStage(orders || []);

    return NextResponse.json({ stats });
  } catch (err) {
    console.error("My stats API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

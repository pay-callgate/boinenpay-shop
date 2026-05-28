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

    // 운영 DB 스키마 편차(예: paid_at/desired_delivery_date 미존재)에도 통계가 0으로 고정되지 않도록
    // 확장 필드 조회 실패 시 기본 필드로 한 번 더 조회한다.
    let orders: Array<{
      status: string;
      payment_status?: string | null;
      paid_at?: string | null;
      created_at?: string | null;
      desired_delivery_date?: string | null;
    }> | null = null;

    const primary = await supabase
      .from("orders")
      .select("status, payment_status, paid_at, created_at, desired_delivery_date")
      .eq("user_id", session.user.id)
      .eq("client_id", clientId)
      .eq("payment_status", "paid");

    if (primary.error) {
      // 운영 환경별 PostgREST 에러 문구 차이로 정규식 매칭이 누락될 수 있다.
      // primary가 실패하면 원인과 무관하게 하위 호환 쿼리를 1회 시도한다.
      console.warn("My stats primary fetch failed; trying fallback:", primary.error);
      const fallback = await supabase
        .from("orders")
        .select("status, payment_status, created_at")
        .eq("user_id", session.user.id)
        .eq("client_id", clientId)
        .eq("payment_status", "paid");
      if (fallback.error) {
        console.error("My stats fallback fetch error:", fallback.error);
        return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
      }
      orders = (fallback.data || []) as typeof orders;
    } else {
      orders = (primary.data || []) as typeof orders;
    }

    /** 주문 목록(`/api/mypage/orders`)과 동일: 결제 완료 건만, 4단계는 `resolveShopFulfillmentStage` 기준 */
    const stats = countOrdersByShopFulfillmentStage(orders || []);

    return NextResponse.json({ stats });
  } catch (err) {
    console.error("My stats API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T6-2: 사용자 주문 목록 조회 API
 * GET /api/mypage/orders?clientId=xxx&status=xxx
 * - 현재 로그인 사용자의 주문 내역
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawClientId = searchParams.get("clientId");
    const clientId =
      typeof rawClientId === "string" && rawClientId.trim() && rawClientId !== "undefined" && rawClientId !== "null"
        ? rawClientId.trim()
        : null;
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId가 필요합니다. (거래처 단위 조회)" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 기본 쿼리: user_id + client_id (테넌트 격리). client 조인 제거로 FK 조인으로 인한 행 누락 방지
    let query = supabase
      .from("orders")
      .select(
        `
        *,
        order_items (
          id,
          product_id,
          product_name,
          option_json,
          quantity,
          unit_price,
          total_price
        )
      `,
        { count: "exact" }
      )
      .eq("user_id", session.user.id)
      .eq("client_id", clientId);

    // 상태 필터: status가 없거나 'all'이면 전체 조회, 그 외에는 정확히 .eq('status', status)
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // 정렬 및 페이지네이션
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      console.error("My orders fetch error:", error);
      return NextResponse.json({ error: "주문 조회 실패" }, { status: 500 });
    }

    return NextResponse.json({
      orders: orders || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("My orders API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

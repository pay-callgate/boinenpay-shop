import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchDashboardRealChartBars } from "@/lib/admin-dashboard-real-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/dashboard-real/chart
 * 최근 7일(KST) 결제완료 매출 — 일별 합계(만 원 단위 막대용)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const supabase = createServerSupabase();
    const { data: adminRow } = await supabase
      .from("partner_admins")
      .select("partner_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!adminRow?.partner_id) {
      return NextResponse.json(
        { ok: false, message: "파트너 권한이 없습니다." },
        { status: 403 }
      );
    }

    const partnerId = adminRow.partner_id as string;
    const bars = await fetchDashboardRealChartBars(supabase, partnerId);

    return NextResponse.json({ ok: true, data: { bars } });
  } catch (e) {
    console.error("[GET /api/admin/dashboard-real/chart]", e);
    return NextResponse.json(
      { ok: false, message: "서버 오류" },
      { status: 500 }
    );
  }
}

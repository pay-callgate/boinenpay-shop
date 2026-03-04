import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/** 상품/카테고리 빈 목록 원인 분석용 — 터미널 로그. 캐시 완전 무력화 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET: 내 파트너 정보 (세션 기반 — partner_admins에서 partner_id 조회 후 해당 파트너만 반환).
 * 중앙 집중형 어드민: subdomain 쿼리 없음.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log("[API /api/partner] 401 - 세션 없음");
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 }
      );
    }

    const supabase = createServerSupabase();
    const { data: adminRow, error: adminError } = await supabase
      .from("partner_admins")
      .select("partner_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    console.log("[API /api/partner]", {
      userId: session.user.id,
      hasAdminRow: !!adminRow,
      partnerId: adminRow?.partner_id ?? null,
      adminError: adminError?.message ?? null,
    });

    if (!adminRow?.partner_id) {
      console.log("[API /api/partner] data: null — partner_admins에 해당 user_id 없음");
      return NextResponse.json({ success: true, data: null });
    }

    const { data: partner } = await supabase
      .from("partners")
      .select("id, subdomain, company_name, verification_status, contact")
      .eq("id", adminRow.partner_id)
      .maybeSingle();
    if (!partner) {
      console.log("[API /api/partner] data: null — partners 행 없음");
      return NextResponse.json({ success: true, data: null });
    }

    console.log("[API /api/partner] 200", { partnerId: partner.id, company_name: partner.company_name });
    return NextResponse.json({ success: true, data: partner });
  } catch (err) {
    console.error("[API /api/partner] error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}

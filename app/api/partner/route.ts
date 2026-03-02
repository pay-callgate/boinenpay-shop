import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET: 내 파트너 정보 (세션 기반 — partner_admins에서 partner_id 조회 후 해당 파트너만 반환).
 * 중앙 집중형 어드민: subdomain 쿼리 없음.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
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
      return NextResponse.json({ success: true, data: null });
    }

    const { data: partner } = await supabase
      .from("partners")
      .select("id, subdomain, company_name, verification_status")
      .eq("id", adminRow.partner_id)
      .maybeSingle();
    if (!partner) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: partner });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}

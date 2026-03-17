import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 부운영자 온보딩용: 이미 등록된 파트너사 목록 조회 (id, company_name).
 * 로그인 사용자만 호출 가능.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 }
      );
    }

    const supabase = createServerSupabase();
    const { data: partners, error } = await supabase
      .from("partners")
      .select("id, company_name, franchise_name")
      .order("company_name", { ascending: true });

    if (error) {
      console.error("[API partners/list]", error);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "파트너 목록 조회 실패" } },
        { status: 500 }
      );
    }

    // 드롭다운 표시명: company_name(사업자명) 우선, 없으면 franchise_name(가맹점명)
    const list = (partners ?? []).map((p: { id: string; company_name: string | null; franchise_name: string | null }) => ({
      id: p.id,
      name: p.company_name?.trim() || p.franchise_name?.trim() || "(이름 없음)",
    }));

    return NextResponse.json({ success: true, data: list });
  } catch (e) {
    console.error("[API partners/list]", e);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}

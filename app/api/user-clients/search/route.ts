import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T3.5-2: 거래처 검색 API (소속 기업 찾기용)
 * GET /api/user-clients/search?partnerId=xxx&q=검색어
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");
    const query = searchParams.get("q") || "";

    if (!partnerId) {
      return NextResponse.json(
        { error: "partnerId가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 거래처 검색 (이름으로 검색) - verified + pending 모두 노출 (소속 기업 등록용)
    let dbQuery = supabase
      .from("clients")
      .select("id, slug, name, logo_url")
      .eq("partner_id", partnerId)
      .in("verification_status", ["verified", "pending"])
      .order("name", { ascending: true })
      .limit(20);

    // 검색어가 있으면 이름 부분 일치
    if (query.trim()) {
      dbQuery = dbQuery.ilike("name", `%${query.trim()}%`);
    }

    const { data: clients, error } = await dbQuery;

    if (error) {
      console.error("Clients search error:", error);
      return NextResponse.json(
        { error: "거래처 검색 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({ clients: clients || [] });
  } catch (err) {
    console.error("Clients search API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

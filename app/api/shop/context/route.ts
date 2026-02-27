import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 쇼핑몰 공개 컨텍스트 API (인증 불필요)
 * GET /api/shop/context?subdomain=xxx
 * - 파트너 정보 + 해당 파트너의 거래처 목록 반환
 * - 거래처 전용 URL(/{subdomain}/{clientSlug}) 페이지 로드 시 사용
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get("subdomain");

    if (!subdomain) {
      return NextResponse.json(
        { error: "subdomain이 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("id, subdomain, company_name, verification_status")
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (partnerError || !partner) {
      return NextResponse.json(
        { partner: null, clients: [] },
        { status: 200 }
      );
    }

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, partner_id, slug, name, logo_url")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false });

    if (clientsError) {
      return NextResponse.json(
        { partner, clients: [] },
        { status: 200 }
      );
    }

    return NextResponse.json({
      partner: {
        id: partner.id,
        subdomain: partner.subdomain,
        company_name: partner.company_name,
      },
      clients: clients || [],
    });
  } catch (err) {
    console.error("Shop context API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

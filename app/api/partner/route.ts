import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET: 내 파트너 정보 (subdomain 쿼리로 해당 파트너만).
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
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get("subdomain");
    if (!subdomain) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "subdomain 필요" } },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { data: partner } = await supabase
      .from("partners")
      .select("id, subdomain, company_name, verification_status")
      .eq("subdomain", subdomain)
      .maybeSingle();
    if (!partner) {
      return NextResponse.json({ success: true, data: null });
    }

    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", partner.id)
      .maybeSingle();
    if (!admin) {
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

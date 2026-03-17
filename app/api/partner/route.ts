import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/** 상품/카테고리 빈 목록 원인 분석용 — 터미널 로그. 캐시 완전 무력화 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** PATCH 허용 필드 (partners 테이블 컬럼) */
const PATCH_ALLOWED_KEYS = [
  "company_name",
  "business_registration_number",
  "corporate_registration_number",
  "business_type",
  "business_category",
  "representative",
  "representative_dob",
  "email",
  "contact",
  "postcode",
  "address",
  "logo_url",
] as const;

/**
 * GET: 내 파트너 정보 (세션 기반 — partner_admins에서 partner_id 조회 후 해당 파트너만 반환).
 * 중앙 집중형 어드민: subdomain 쿼리 없음.
 */
export async function GET() {
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

    const { data: partnerData } = await supabase
      .from("partners")
      .select(
        [
          "id",
          "subdomain",
          "company_name",
          "verification_status",
          "business_registration_number",
          "representative",
          "postcode",
          "address",
          "business_type",
          "contact",
          "fax",
          "business_category",
          "email",
          "trade_categories",
          "franchise_name",
          "corporate_registration_number",
          "representative_dob",
          "logo_url",
        ].join(", ")
      )
      .eq("id", adminRow.partner_id)
      .maybeSingle();

    if (!partnerData) {
      console.log("[API /api/partner] data: null — partners 행 없음");
      return NextResponse.json({ success: true, data: null });
    }

    // Supabase 타입이 data를 GenericStringError 유니온으로 추론하는 경우 대비 (unknown 경유 단언)
    const partner = partnerData as unknown as { id: string; company_name: string | null; [key: string]: unknown };
    console.log("[API /api/partner] 200", { partnerId: partner.id, company_name: partner.company_name });
    return NextResponse.json({ success: true, data: partnerData });
  } catch (err) {
    console.error("[API /api/partner] error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}

/**
 * PATCH: 파트너 정보 수정 (세션 기반, partner_admins 권한 확인)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const payload: Record<string, unknown> = {};

    for (const key of PATCH_ALLOWED_KEYS) {
      if (body[key] !== undefined) {
        payload[key] = body[key] === "" ? null : body[key];
      }
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "수정할 항목이 없습니다." } },
        { status: 400 }
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
        { success: false, error: { code: "FORBIDDEN", message: "파트너 권한이 없습니다." } },
        { status: 403 }
      );
    }

    const { data: updated, error } = await supabase
      .from("partners")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", adminRow.partner_id)
      .select()
      .single();

    if (error) {
      console.error("[API /api/partner] PATCH error:", error);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "파트너 정보 수정에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[API /api/partner] PATCH error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}

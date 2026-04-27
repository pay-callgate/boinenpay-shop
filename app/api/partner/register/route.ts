import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T1-2: 파트너 기업 등록.
 * partners insert + partner_admins insert, users.role → partner_admin
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      franchiseName,
      businessRegistrationNumber,
      corporateRegistrationNumber,
      companyName,
      representative,
      representativeDob,
      address,
      postcode,
      businessType,
      representativeContact,
      fax,
      businessCategory,
      representativeEmail,
      tradeCategories,
      subdomain,
    } = body;

    // 필수 필드 검증 (새 필드명 적용)
    if (!subdomain || !businessRegistrationNumber || !companyName || !representative || !address || !representativeEmail) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "필수: subdomain, 사업자번호, 사업자명, 대표자, 주소, 대표자 이메일",
          },
        },
        { status: 400 }
      );
    }

    const brn = String(businessRegistrationNumber).replace(/-/g, "");
    if (!/^\d{10}$/.test(brn)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "사업자등록번호 10자리 숫자" },
        },
        { status: 400 }
      );
    }

    const slug = String(subdomain).toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "subdomain은 영문/숫자만 가능합니다." },
        },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: existingPartner } = await supabase
      .from("partners")
      .select("id")
      .eq("subdomain", slug)
      .maybeSingle();
    if (existingPartner) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CONFLICT", message: "이미 사용 중인 subdomain입니다." },
        },
        { status: 409 }
      );
    }

    // 검증 API와 연동 시 여기서 한 번 더 검증 후 status 결정. MVP에서는 등록 시 verified 처리.
    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .insert({
        owner_id: session.user.id,                                        // 🔥 세션 유저 ID 저장
        subdomain: slug,
        franchise_name: franchiseName ?? null,
        business_registration_number: brn,
        corporate_registration_number: corporateRegistrationNumber ?? null,
        company_name: companyName,
        representative,
        representative_dob: representativeDob ?? null,
        address,
        postcode: postcode ?? null,
        business_type: businessType ?? null,
        contact: representativeContact ?? null,
        fax: fax ?? null,
        business_category: businessCategory ?? null,
        email: representativeEmail,
        trade_categories: Array.isArray(tradeCategories) ? tradeCategories : null,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (partnerError || !partner) {
      console.error("❌ [API] Partner insert error:", partnerError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: partnerError?.message ?? "파트너 등록 실패",
            details: partnerError?.details,
            hint: partnerError?.hint,
          },
        },
        { status: 500 }
      );
    }

    console.log("✅ [API] Partner 생성 완료:", partner.id);

    // 🔥 UUID 검증 제거! auth.ts가 완벽하게 처리함
    const { error: adminError } = await supabase.from("partner_admins").insert({
      user_id: session.user.id,
      partner_id: partner.id,
    });
    if (adminError) {
      console.error("❌ [API] Partner admin insert error:", adminError);
      await supabase.from("partners").delete().eq("id", partner.id);
      return NextResponse.json(
        {
          success: false,
          error: { 
            code: "INTERNAL_ERROR", 
            message: adminError.message,
            details: adminError.details,
            hint: adminError.hint,
          },
        },
        { status: 500 }
      );
    }

    console.log("✅ [API] Partner admin 연결 완료");

    await supabase
      .from("users")
      .update({
        role: "partner_admin",
        profile_completed: true,
        terms_agreed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    console.log("✅ [API] 파트너 등록 완전히 성공! Partner ID:", partner.id);

    return NextResponse.json({
      success: true,
      data: { partnerId: partner.id, subdomain: slug },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}

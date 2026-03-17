import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 부운영자 온보딩: 선택한 파트너 + 사업자등록번호로 partners 테이블 검증.
 * 일치 시 파트너 정보 반환(자동 완성용).
 */
export const dynamic = "force-dynamic";

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
    const { partnerId, businessRegistrationNumber } = body;

    if (!partnerId || businessRegistrationNumber == null || businessRegistrationNumber === "") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "파트너와 사업자등록번호를 입력해 주세요." } },
        { status: 400 }
      );
    }

    const brn = String(businessRegistrationNumber).replace(/-/g, "").trim();
    if (!/^\d{10}$/.test(brn)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "사업자등록번호 10자리 숫자를 입력해 주세요." } },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 1) 선택한 파트너 존재 여부 확인
    const { data: partnerRow, error: partnerErr } = await supabase
      .from("partners")
      .select("id, company_name, representative, address, postcode, email, contact, business_type, business_category, business_registration_number")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerErr) {
      console.error("[API partner/verify]", partnerErr);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "검증 중 오류가 발생했습니다." } },
        { status: 500 }
      );
    }

    if (!partnerRow) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "선택한 파트너를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    // 2) 사업자등록번호 일치 여부 (숫자만 비교, DB에 하이픈 없이 저장된 경우 대비)
    const storedBrn = partnerRow.business_registration_number
      ? String(partnerRow.business_registration_number).replace(/-/g, "").trim()
      : "";
    if (storedBrn !== brn) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_MATCH",
            message:
              "선택한 파트너(기업)에 등록된 사업자등록번호와 일치하지 않습니다. 파트너 관리에서 등록된 번호를 확인한 뒤 다시 시도해 주세요.",
          },
        },
        { status: 400 }
      );
    }

    const partner = {
      id: partnerRow.id,
      company_name: partnerRow.company_name,
      representative: partnerRow.representative,
      address: partnerRow.address,
      postcode: partnerRow.postcode,
      email: partnerRow.email,
      contact: partnerRow.contact,
      business_type: partnerRow.business_type,
      business_category: partnerRow.business_category,
    };

    return NextResponse.json({
      success: true,
      data: {
        id: partner.id,
        companyName: partner.company_name,
        representative: partner.representative,
        address: partner.address,
        postcode: partner.postcode,
        email: partner.email,
        contact: partner.contact,
        businessType: partner.business_type,
        businessCategory: partner.business_category,
      },
    });
  } catch (e) {
    console.error("[API partner/verify]", e);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}

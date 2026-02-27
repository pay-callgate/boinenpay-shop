import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * T1-3: 사업자등록번호 검증.
 * 파트너/거래처 공통. 외부 API 연동 전 형식 검증 + 목업 응답.
 */
export async function POST(request: Request) {
  try {
    await getServerSession(authOptions); // 인증 권장(선택)
    const body = await request.json();
    const businessRegistrationNumber = body?.businessRegistrationNumber?.replace?.(/-/g, "") ?? "";

    if (!businessRegistrationNumber || businessRegistrationNumber.length !== 10) {
      return NextResponse.json(
        {
          success: true,
          data: {
            valid: false,
            message: "사업자등록번호 10자리를 입력해 주세요.",
          },
        },
        { status: 200 }
      );
    }

    if (!/^\d{10}$/.test(businessRegistrationNumber)) {
      return NextResponse.json(
        {
          success: true,
          data: {
            valid: false,
            message: "숫자 10자리로 입력해 주세요.",
          },
        },
        { status: 200 }
      );
    }

    // TODO: 국세청/공공 API 연동 시 여기서 호출 후 valid, companyName, businessStatus 반영
    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        companyName: "주식회사 연미당",
        businessStatus: "운영중",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}

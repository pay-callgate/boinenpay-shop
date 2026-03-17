import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 부운영자 등록: 현재 로그인 사용자를 선택한 파트너의 운영자로 등록.
 * partner_admins insert + users.name, users.phone 업데이트 + users.role = partner_admin
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
    const { partnerId, name, contact } = body;

    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "소속 파트너를 선택해 주세요." } },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 파트너 존재 여부 확인
    const { data: partner, error: partnerErr } = await supabase
      .from("partners")
      .select("id")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerErr || !partner) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "해당 파트너를 찾을 수 없습니다." } },
        { status: 404 }
      );
    }

    // 이미 해당 파트너의 운영자인지 확인
    const { data: existing } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", partnerId)
      .maybeSingle();

    // users 테이블: name, phone 업데이트, role = partner_admin (신규/기존 공통)
    const updates: { role: string; updated_at: string; name?: string; phone?: string } = {
      role: "partner_admin",
      updated_at: new Date().toISOString(),
    };
    if (name != null && String(name).trim() !== "") updates.name = String(name).trim();
    if (contact != null && String(contact).trim() !== "") updates.phone = String(contact).trim();
    await supabase.from("users").update(updates).eq("id", session.user.id);

    if (existing) {
      return NextResponse.json({
        success: true,
        data: { message: "운영자 정보가 수정되었습니다.", partnerId },
      }, { status: 200 });
    }

    // partner_admins insert (신규만)
    const { error: insertError } = await supabase.from("partner_admins").insert({
      user_id: session.user.id,
      partner_id: partnerId,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { success: true, data: { message: "이미 등록된 운영자입니다. 정보가 수정되었습니다.", partnerId } },
          { status: 200 }
        );
      }
      console.error("[API partner/join] partner_admins insert:", insertError);
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: insertError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: "운영자 등록이 완료되었습니다.", partnerId },
    });
  } catch (e) {
    console.error("[API partner/join]", e);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "서버 오류" } },
      { status: 500 }
    );
  }
}

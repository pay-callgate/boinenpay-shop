import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T6-3: 배송지 관리 API
 * GET /api/mypage/addresses - 배송지 목록
 * POST /api/mypage/addresses - 배송지 추가
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const supabase = createServerSupabase();

    const { data: addresses, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", session.user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Addresses fetch error:", error);
      return NextResponse.json({ error: "배송지 조회 실패" }, { status: 500 });
    }

    const list = addresses || [];
    if (list.length === 0) {
      console.log("[mypage/addresses] 빈 목록 — session.user.id:", session.user.id, "(DB addresses.user_id와 일치하는지 확인)");
    }
    return NextResponse.json({ addresses: list });
  } catch (err) {
    console.error("Addresses API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { name, phone, postcode, address, detail, isDefault } = await request.json();

    // 필수 항목 검증
    if (!name || !phone || !address) {
      return NextResponse.json(
        { error: "배송지 정보를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 기본 배송지로 설정할 경우, 기존 기본 배송지 해제
    if (isDefault) {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", session.user.id)
        .eq("is_default", true);
    }

    // 새 배송지 추가 (postcode는 DB에서 NOT NULL이므로 빈 문자열 허용)
    const { data: newAddress, error } = await supabase
      .from("addresses")
      .insert({
        user_id: session.user.id,
        name,
        phone,
        postcode: postcode != null && String(postcode).trim() !== "" ? String(postcode).trim() : "",
        address,
        detail: detail || null,
        is_default: isDefault || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Address insert error:", error);
      return NextResponse.json({ error: "배송지 추가 실패" }, { status: 500 });
    }

    return NextResponse.json({ address: newAddress, message: "배송지가 추가되었습니다." });
  } catch (err) {
    console.error("Address POST API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

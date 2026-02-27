import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T6-4: 회원정보 수정 API (테넌트 격리: clientId 필수)
 * GET /api/mypage/profile?clientId=xxx - 회원정보 조회
 * PUT /api/mypage/profile?clientId=xxx - 회원정보 수정
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId가 필요합니다. (거래처 단위 조회)" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 권한 검사: user_clients(직원) 또는 orders(구매 이력) — 예외 없이 안전하게 (절대 .single() 미사용)
    const [userClientsRes, ordersRes] = await Promise.all([
      supabase
        .from("user_clients")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("client_id", clientId)
        .limit(1),
    ]);
    const isMember = !!userClientsRes.data;
    const hasOrder = Array.isArray(ordersRes.data) && ordersRes.data.length > 0;
    if (!isMember && !hasOrder) {
      return NextResponse.json(
        { error: "해당 거래처에 대한 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 프로필 조회 — .maybeSingle() 사용, 없으면 빈 객체 반환 (500 금지). avatar_url은 스키마에 있을 때만 추가.
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email, phone")
      .eq("id", session.user.id)
      .maybeSingle();

    if (userError) {
      console.error("User fetch error:", userError);
      return NextResponse.json({ error: "사용자 정보 조회 실패" }, { status: 500 });
    }
    return NextResponse.json({ user: user ?? {} });
  } catch (err) {
    console.error("Profile GET API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId가 필요합니다. (거래처 단위 수정)" },
        { status: 400 }
      );
    }

    const { name, phone } = await request.json();

    // 필수 항목 검증
    if (!name) {
      return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // 권한 검사: user_clients(직원) 또는 orders(구매 이력) — 예외 없이 안전하게
    const [userClientsRes, ordersRes] = await Promise.all([
      supabase
        .from("user_clients")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("client_id", clientId)
        .limit(1),
    ]);
    const isMember = !!userClientsRes.data;
    const hasOrder = Array.isArray(ordersRes.data) && ordersRes.data.length > 0;
    if (!isMember && !hasOrder) {
      return NextResponse.json(
        { error: "해당 거래처에 대한 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 회원정보 수정 — 반환은 .maybeSingle()로 0건 시 예외 방지
    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        name,
        phone: phone || null,
      })
      .eq("id", session.user.id)
      .select("id, name, email, phone")
      .maybeSingle();

    if (updateError) {
      console.error("Profile update error:", updateError);
      return NextResponse.json({ error: "회원정보 수정 실패" }, { status: 500 });
    }
    return NextResponse.json({
      user: updatedUser ?? {},
      message: "회원정보가 수정되었습니다.",
    });
  } catch (err) {
    console.error("Profile PUT API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

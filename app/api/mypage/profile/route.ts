import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = ReturnType<typeof createServerSupabase>;

/** 403 응답 시 프론트 안내용: DB 등록 소속 거래처(없으면 null) */
async function fetchRegisteredClientHint(
  supabase: ServerSupabase,
  userId: string
): Promise<{
  name: string;
  slug: string;
  partnerSubdomain: string;
} | null> {
  const { data: uc } = await supabase
    .from("user_clients")
    .select("client_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!uc?.client_id) return null;

  const { data: cl } = await supabase
    .from("clients")
    .select("name, slug, partner_id")
    .eq("id", uc.client_id)
    .maybeSingle();
  if (!cl) return null;

  const { data: p } = await supabase
    .from("partners")
    .select("subdomain")
    .eq("id", cl.partner_id)
    .maybeSingle();

  return {
    name: String(cl.name ?? "").trim() || "등록 거래처",
    slug: String(cl.slug ?? "").trim(),
    partnerSubdomain: String(p?.subdomain ?? "").trim(),
  };
}

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
      const registeredClient = await fetchRegisteredClientHint(
        supabase,
        session.user.id
      );
      return NextResponse.json(
        {
          error: "이 전용몰에서는 회원정보를 조회할 수 없습니다. 소속 거래처 전용몰에서 이용해 주세요.",
          registeredClient,
        },
        { status: 403 }
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, name, email, phone")
      .eq("id", session.user.id)
      .maybeSingle();

    if (userError) {
      console.error("User fetch error:", userError);
      return NextResponse.json(
        { error: "일시적으로 회원정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 }
      );
    }
    if (!user?.id) {
      return NextResponse.json(
        {
          error:
            "회원 정보를 찾을 수 없습니다. 문제가 계속되면 관리자에게 문의해 주세요.",
          user: null,
        },
        { status: 404 }
      );
    }
    return NextResponse.json({ user });
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
      const registeredClient = await fetchRegisteredClientHint(
        supabase,
        session.user.id
      );
      return NextResponse.json(
        {
          error: "이 전용몰에서는 회원정보를 수정할 수 없습니다. 소속 거래처 전용몰에서 이용해 주세요.",
          registeredClient,
        },
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

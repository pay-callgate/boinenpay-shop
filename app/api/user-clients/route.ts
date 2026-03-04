import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { UserClientRole } from "@/types/user-client";

/**
 * T3.5-1, T3.5-2: 사용자-거래처 매핑 API
 * GET /api/user-clients - 현재 사용자의 거래처 매핑 조회
 * POST /api/user-clients - 사용자-거래처 매핑 생성 (자동/수동 매칭)
 */

// GET: 현재 사용자의 거래처 매핑 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");

    const supabase = createServerSupabase();

    let query = supabase
      .from("user_clients")
      .select(`
        *,
        clients (
          id,
          slug,
          name,
          logo_url,
          partner_id
        )
      `)
      .eq("user_id", session.user.id);

    // partnerId가 있으면 해당 파트너의 거래처만 필터링
    if (partnerId) {
      const { data: userClients, error } = await query;
      
      if (error) {
        console.error("User-clients fetch error:", error);
        return NextResponse.json(
          { error: "사용자 거래처 조회 실패" },
          { status: 500 }
        );
      }

      // 파트너 ID로 필터링
      const filtered = (userClients || []).filter(
        (uc: { clients: { partner_id: string } | null }) => 
          uc.clients?.partner_id === partnerId
      );

      return NextResponse.json({ userClients: filtered });
    }

    const { data: userClients, error } = await query;

    if (error) {
      console.error("User-clients fetch error:", error);
      return NextResponse.json(
        { error: "사용자 거래처 조회 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({ userClients: userClients || [] });
  } catch (err) {
    console.error("User-clients API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 사용자-거래처 매핑 생성 (자동/수동 매칭)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, clientSlug, partnerId, role } = body as {
      clientId?: string;
      clientSlug?: string;
      partnerId?: string;
      role?: UserClientRole;
    };

    if (!clientId && !clientSlug) {
      return NextResponse.json(
        { error: "clientId 또는 clientSlug가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // clientSlug로 요청한 경우 clientId 조회
    let targetClientId = clientId;
    if (!targetClientId && clientSlug && partnerId) {
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("slug", clientSlug)
        .eq("partner_id", partnerId)
        .single();

      if (!client) {
        return NextResponse.json(
          { error: "해당 거래처를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      targetClientId = client.id;
    }

    // 기존 매핑 확인 (user_clients는 user_id가 PK/UNIQUE — 1:1)
    const { data: existingByUser } = await supabase
      .from("user_clients")
      .select(`
        id,
        user_id,
        client_id,
        role,
        clients (
          id,
          slug,
          name,
          logo_url,
          partner_id
        )
      `)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (existingByUser) {
      // 이미 해당 유저의 매핑이 있으면 성공 반환 (동일 client면 그대로, 다르면 "이미 다른 거래처 매핑됨")
      const sameClient = existingByUser.client_id === targetClientId;
      return NextResponse.json(
        {
          userClient: existingByUser,
          message: sameClient
            ? "이미 매핑되어 있습니다."
            : "이미 다른 거래처에 매핑되어 있습니다. 기존 매핑을 반환합니다.",
        },
        { status: 200 }
      );
    }

    // 새 매핑 생성 (user_clients.role CHECK: 'member' | 'admin' 만 허용)
    const insertRole: UserClientRole = role === "admin" ? "admin" : "member";
    const { data: userClient, error } = await supabase
      .from("user_clients")
      .insert({
        user_id: session.user.id,
        client_id: targetClientId,
        role: insertRole,
      })
      .select(`
        *,
        clients (
          id,
          slug,
          name,
          logo_url,
          partner_id
        )
      `)
      .single();

    if (error) {
      // 중복 키(이미 존재)면 500 대신 기존 행 조회 후 200
      if (error.code === "23505") {
        const { data: existing } = await supabase
          .from("user_clients")
          .select(`
            *,
            clients (
              id,
              slug,
              name,
              logo_url,
              partner_id
            )
          `)
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (existing) {
          return NextResponse.json({
            userClient: existing,
            message: "이미 매핑되어 있습니다.",
          });
        }
      }
      console.error("User-client create error:", error);
      return NextResponse.json(
        { error: "거래처 매핑 생성 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      userClient,
      message: "기업정보가 정상 등록되었습니다.",
    }, { status: 201 });
  } catch (err) {
    console.error("User-clients POST error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

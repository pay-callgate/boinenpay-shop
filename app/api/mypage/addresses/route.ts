import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getClientRow, hasMypageClientAccess } from "@/lib/mypage-client-access";

/**
 * T6-3: 배송지 관리 API (거래처 client_id 격리)
 * GET /api/mypage/addresses?clientId=xxx
 * POST /api/mypage/addresses — body.clientId 필수
 *
 * DB: lib/addresses-client-id-schema.ts DDL 적용 필요
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const clientId = request.nextUrl.searchParams.get("clientId")?.trim() ?? "";
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId가 필요합니다. (거래처 단위 배송지)" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const allowed = await hasMypageClientAccess(
      supabase,
      session.user.id,
      clientId
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "해당 거래처에 대한 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    const { data: addresses, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("client_id", clientId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Addresses fetch error:", error);
      return NextResponse.json({ error: "배송지 조회 실패" }, { status: 500 });
    }

    const list = addresses || [];
    return NextResponse.json({ addresses: list });
  } catch (err) {
    console.error("Addresses API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const {
      clientId: rawClientId,
      name,
      phone,
      postcode,
      address,
      detail,
      isDefault,
    } = body as {
      clientId?: string;
      name?: string;
      phone?: string;
      postcode?: string;
      address?: string;
      detail?: string;
      isDefault?: boolean;
    };

    const clientId = String(rawClientId ?? "").trim();
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId가 필요합니다. (거래처 단위 배송지)" },
        { status: 400 }
      );
    }

    if (!name || !phone || !address) {
      return NextResponse.json(
        { error: "배송지 정보를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const clientRow = await getClientRow(supabase, clientId);
    if (!clientRow) {
      return NextResponse.json(
        { error: "거래처 정보가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const allowed = await hasMypageClientAccess(
      supabase,
      session.user.id,
      clientId
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "해당 거래처에 대한 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (isDefault) {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", session.user.id)
        .eq("client_id", clientId)
        .eq("is_default", true);
    }

    const { data: newAddress, error } = await supabase
      .from("addresses")
      .insert({
        user_id: session.user.id,
        client_id: clientId,
        name,
        phone,
        postcode:
          postcode != null && String(postcode).trim() !== ""
            ? String(postcode).trim()
            : "",
        address,
        detail: detail || null,
        is_default: isDefault || false,
      })
      .select()
      .single();

    if (error) {
      console.error("Address insert error:", error);
      return NextResponse.json(
        {
          error:
            "배송지 추가 실패. DB에 addresses.client_id 컬럼이 없으면 lib/addresses-client-id-schema.ts DDL을 적용해 주세요.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      address: newAddress,
      message: "배송지가 추가되었습니다.",
    });
  } catch (err) {
    console.error("Address POST API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

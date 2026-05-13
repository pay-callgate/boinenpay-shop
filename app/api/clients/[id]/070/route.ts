import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

import { upsertClientCall070Config } from "@/lib/clients/upsert-call-070-config";

/**
 * T3-4: 070 연동 설정 API
 * GET /api/clients/[id]/070 - 070 설정 조회
 * POST /api/clients/[id]/070 - 070 설정 생성/수정
 */

// GET: 070 설정 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerSupabase();

    const { data: config, error } = await supabase
      .from("client_call_070_configs")
      .select("*")
      .eq("client_id", id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("070 config fetch error:", error);
      return NextResponse.json(
        { error: "070 설정 조회 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({ config: config || null });
  } catch (err) {
    console.error("070 config GET error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 070 설정 생성/수정
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: clientId } = await params;
    const body = await request.json();
    const {
      call070Number,
      greetingMessage,
      industry,
      adminName,
      adminEmail,
      adminPhone,
      smsTextTemplate,
    } = body;

    if (!call070Number) {
      return NextResponse.json(
        { error: "서비스 번호(070)는 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: before } = await supabase
      .from("client_call_070_configs")
      .select("id")
      .eq("client_id", clientId)
      .maybeSingle();

    try {
      const config = await upsertClientCall070Config(supabase, clientId, {
        call070Number,
        greetingMessage,
        industry,
        adminName,
        adminEmail,
        adminPhone,
        smsTextTemplate,
      });
      return NextResponse.json({ config }, { status: before ? 200 : 201 });
    } catch (error) {
      console.error("070 config upsert error:", error);
      return NextResponse.json({ error: "070 설정 저장 실패" }, { status: 500 });
    }
  } catch (err) {
    console.error("070 config POST error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

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

    // 기존 설정 확인
    const { data: existing } = await supabase
      .from("client_call_070_configs")
      .select("id")
      .eq("client_id", clientId)
      .maybeSingle();

    if (existing) {
      // 업데이트
      const { data: config, error } = await supabase
        .from("client_call_070_configs")
        .update({
          call_070_number: call070Number,
          greeting_message: greetingMessage || null,
          industry: industry || null,
          admin_name: adminName || null,
          admin_email: adminEmail || null,
          admin_phone: adminPhone || null,
          sms_text_template: smsTextTemplate || null,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("070 config update error:", error);
        return NextResponse.json(
          { error: "070 설정 수정 실패" },
          { status: 500 }
        );
      }

      return NextResponse.json({ config });
    } else {
      // 생성
      const { data: config, error } = await supabase
        .from("client_call_070_configs")
        .insert({
          client_id: clientId,
          call_070_number: call070Number,
          greeting_message: greetingMessage || null,
          industry: industry || null,
          admin_name: adminName || null,
          admin_email: adminEmail || null,
          admin_phone: adminPhone || null,
          sms_text_template: smsTextTemplate || null,
          callcloud_registered: false,
        })
        .select()
        .single();

      if (error) {
        console.error("070 config create error:", error);
        return NextResponse.json(
          { error: "070 설정 생성 실패" },
          { status: 500 }
        );
      }

      return NextResponse.json({ config }, { status: 201 });
    }
  } catch (err) {
    console.error("070 config POST error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

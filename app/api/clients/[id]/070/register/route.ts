import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { runCallCloudRegister } from "@/lib/callcloud-playwright";
import { getStorefrontUrl } from "@/lib/app-url";

/**
 * T3-5 / M7: CallCloud 070 연동 (Strict Consistency)
 * POST /api/clients/[id]/070/register
 *
 * 흐름: 프론트 Payload 수신 → 봇 선 실행 → 성공 시에만 DB 저장
 * - Playwright 봇 실패 시 DB 미접근, 즉시 에러 반환
 * - 봇 success: true 시에만 client_call_070_configs Upsert + clients.call_070_connected = true
 */

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id: clientId } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      call070Number,
      greetingMessage,
      industry,
      adminName,
      adminEmail,
      adminPhone,
      smsTextTemplate,
    } = body;

    if (!call070Number || !String(call070Number).trim()) {
      return NextResponse.json(
        { error: "서비스 번호(070)는 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // 거래처·파트너 조회 (serviceUrl·clientName용만 사용, DB 저장 아님)
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, slug, partner_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "거래처 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("subdomain")
      .eq("id", client.partner_id)
      .single();

    if (partnerError || !partner?.subdomain) {
      return NextResponse.json(
        { error: "파트너 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const serviceUrl = getStorefrontUrl(partner.subdomain, client.slug);

    // ——— 1. 봇 선(先) 실행 ——— 실패 시 즉시 반환, DB 미접근
    const result = await runCallCloudRegister({
      clientName: client.name,
      call070Number: String(call070Number).trim(),
      greetingMessage:
        greetingMessage ?? `안녕하세요 ${client.name}에 전화 주셔서 감사합니다.`,
      industry: industry ?? "화훼",
      adminName: adminName ?? "",
      adminEmail: adminEmail ?? "",
      adminPhone: adminPhone ?? "",
      serviceUrl,
      smsText: smsTextTemplate ?? `안녕하세요 ${client.name}입니다.`,
    });

    if (!result.success) {
      const isClosed =
        result.error?.includes("브라우저가 종료") ||
        result.error?.includes("has been closed");
      return NextResponse.json(
        {
          error: isClosed
            ? "브라우저가 종료되었거나 연결이 끊어졌습니다. 창을 닫지 말고 다시 시도해 주세요."
            : "CallCloud 자동화 실행 중 오류가 발생했습니다.",
          details: result.error,
        },
        { status: 500 }
      );
    }

    // ——— 2. 봇 성공 시에만 DB 확정 저장 (Commit) ———
    await supabase.from("client_call_070_configs").upsert(
      {
        client_id: clientId,
        call_070_number: String(call070Number).trim(),
        greeting_message: greetingMessage ?? null,
        industry: industry ?? null,
        admin_name: adminName ?? null,
        admin_email: adminEmail ?? null,
        admin_phone: adminPhone ?? null,
        sms_text_template: smsTextTemplate ?? null,
        callcloud_registered: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" }
    );

    await supabase
      .from("clients")
      .update({ call_070_connected: true })
      .eq("id", clientId);

    return NextResponse.json({
      success: true,
      message:
        result.message ?? "070번호 연동이 정상적으로 완료되었습니다.",
      alreadyRegistered: false,
    });
  } catch (err) {
    console.error("070 register API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

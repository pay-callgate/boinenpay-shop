import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { runCallCloudRegister } from "@/lib/callcloud-playwright";
import { getStorefrontUrl } from "@/lib/app-url";

function mask070ForLog(num: string): string {
  const d = (num || "").replace(/\D/g, "");
  if (d.length <= 4) return "(short)";
  return `***${d.slice(-4)}`;
}

function log070Register(
  level: "info" | "warn" | "error",
  runId: string,
  t0: number,
  phase: string,
  message: string,
  extra?: Record<string, unknown>
) {
  const ts = new Date().toISOString();
  const ms = Date.now() - t0;
  const tail =
    extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : "";
  const line = `[070-register][${level.toUpperCase()}][run=${runId}][${ts}][+${ms}ms][${phase}] ${message}${tail}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

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
  const runId = randomUUID();
  const t0 = Date.now();

  try {
    log070Register("info", runId, t0, "request", "POST 수신", {
      vercel: process.env.VERCEL ?? "0",
      nodeEnv: process.env.NODE_ENV ?? "(unset)",
      region: process.env.VERCEL_REGION ?? null,
    });

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      log070Register("warn", runId, t0, "auth", "비로그인 — 401");
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    log070Register("info", runId, t0, "auth", "세션 확인됨", {
      userId: session.user?.email ?? session.user?.name ?? "(no id)",
    });

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

    log070Register("info", runId, t0, "payload", "본문 파싱 완료(민감 일부만)", {
      clientId,
      call070: call070Number
        ? mask070ForLog(String(call070Number))
        : "(empty)",
      hasGreeting: greetingMessage != null && String(greetingMessage).length > 0,
      industry: industry ?? "(default later)",
      hasAdminName: !!adminName?.trim?.(),
      hasAdminEmail: !!adminEmail?.trim?.(),
      hasAdminPhone: !!adminPhone?.trim?.(),
      hasSmsTemplate: smsTextTemplate != null && String(smsTextTemplate).length > 0,
    });

    if (!call070Number || !String(call070Number).trim()) {
      log070Register("warn", runId, t0, "validate", "070 번호 누락 — 400");
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
      log070Register("error", runId, t0, "db.client", "거래처 조회 실패", {
        clientId,
        supabaseError: clientError?.message ?? String(clientError),
      });
      return NextResponse.json(
        { error: "거래처 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    log070Register("info", runId, t0, "db.client", "거래처 로드", {
      clientName: client.name,
      slug: client.slug,
      partnerId: client.partner_id,
    });

    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("subdomain")
      .eq("id", client.partner_id)
      .single();

    if (partnerError || !partner?.subdomain) {
      log070Register("error", runId, t0, "db.partner", "파트너 조회 실패", {
        partnerError: partnerError?.message ?? String(partnerError),
      });
      return NextResponse.json(
        { error: "파트너 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const serviceUrl = getStorefrontUrl(partner.subdomain, client.slug);
    log070Register("info", runId, t0, "url", "serviceUrl 계산 완료", {
      subdomain: partner.subdomain,
      clientSlug: client.slug,
      serviceUrl,
    });

    // ——— 1. 봇 선(先) 실행 ——— 실패 시 즉시 반환, DB 미접근
    log070Register("info", runId, t0, "bot", "runCallCloudRegister 호출 직전", {
      hasBrowserlessWs: !!process.env.BROWSERLESS_WS_ENDPOINT?.trim(),
      call070Headless: process.env.CALLCLOUD_HEADLESS ?? "(unset)",
    });

    const result = await runCallCloudRegister(
      {
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
      },
      { apiRunId: runId }
    );

    log070Register("info", runId, t0, "bot", "runCallCloudRegister 반환", {
      success: result.success,
      messagePreview: result.message?.slice(0, 120) ?? null,
      errorPreview: result.error?.slice(0, 300) ?? null,
    });

    if (!result.success) {
      const isClosed =
        result.error?.includes("브라우저가 종료") ||
        result.error?.includes("has been closed");
      log070Register("error", runId, t0, "bot", "봇 실패 — DB 스킵, 500", {
        isClosed,
        details: result.error,
      });
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
    log070Register("info", runId, t0, "db.commit", "client_call_070_configs upsert 시작");
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

    log070Register("info", runId, t0, "db.commit", "clients.call_070_connected = true");
    await supabase
      .from("clients")
      .update({ call_070_connected: true })
      .eq("id", clientId);

    log070Register("info", runId, t0, "response", "전체 성공", {
      totalMs: Date.now() - t0,
    });
    return NextResponse.json({
      success: true,
      message:
        result.message ?? "070번호 연동이 정상적으로 완료되었습니다.",
      alreadyRegistered: false,
    });
  } catch (err) {
    log070Register("error", runId, t0, "fatal", "예외 처리", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : null,
      totalMs: Date.now() - t0,
    });
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

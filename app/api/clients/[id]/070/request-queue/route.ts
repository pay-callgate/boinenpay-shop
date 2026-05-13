import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStorefrontUrl } from "@/lib/app-url";
import { upsertClientCall070Config } from "@/lib/clients/upsert-call-070-config";
import { append070QueueRow, parseSheetAppendedRow } from "@/lib/integrations/google-sheets-070-queue";
import { postSlack070QueueNotification } from "@/lib/integrations/slack-070-queue";

/**
 * POST /api/clients/[id]/070/request-queue
 * 070 폼 저장 + 구글 시트 행 추가 + 슬랙 알림 (CallCloud 자동화 없음)
 */

export const maxDuration = 60;

function formatKstTimestamp(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

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
    const name = client.name ?? "";
    const callTrim = String(call070Number).trim();

    await upsertClientCall070Config(supabase, clientId, {
      call070Number: callTrim,
      greetingMessage:
        greetingMessage ?? `안녕하세요 ${name}에 전화 주셔서 감사합니다.`,
      industry: industry ?? "화훼",
      adminName: adminName ?? "",
      adminEmail: adminEmail ?? "",
      adminPhone: adminPhone ?? "",
      smsTextTemplate: smsTextTemplate ?? `안녕하세요 ${name}입니다.`,
    });

    const requestedAtKst = formatKstTimestamp(new Date());

    let sheetRow: number | null = null;
    try {
      const { updatedRange } = await append070QueueRow({
        requestedAtKst,
        clientId,
        clientName: name,
        call070Number: callTrim,
        greetingMessage:
          String(greetingMessage ?? "").trim() ||
          `안녕하세요 ${name}에 전화 주셔서 감사합니다.`,
        industry: String(industry ?? "화훼").trim(),
        adminName: String(adminName ?? "").trim(),
        adminEmail: String(adminEmail ?? "").trim(),
        adminPhone: String(adminPhone ?? "").trim(),
        serviceUrl,
        smsTextTemplate:
          String(smsTextTemplate ?? "").trim() || `안녕하세요 ${name}입니다.`,
      });
      sheetRow = parseSheetAppendedRow(updatedRange);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("[070/request-queue] Google Sheets append failed", {
        message: err.message,
        name: err.name,
        clientId,
        spreadsheetIdSet: Boolean(process.env.GOOGLE_SHEETS_070_SPREADSHEET_ID?.trim()),
        spreadsheetIdTail: process.env.GOOGLE_SHEETS_070_SPREADSHEET_ID?.trim()?.slice(-8),
        tabName:
          process.env.GOOGLE_SHEETS_070_TAB_NAME?.trim() || "070연동대기열 (default)",
        hasServiceAccountJson: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()),
        hasServiceAccountBase64: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64?.trim()),
      });
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "구글 시트에 행을 추가하지 못했습니다. 서비스 계정·시트 ID·탭 이름을 확인해 주세요.",
        },
        { status: 502 }
      );
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_070_SPREADSHEET_ID?.trim() ?? "";
    try {
      await postSlack070QueueNotification({
        clientName: name,
        clientId,
        sheetRow,
        spreadsheetId,
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("[070/request-queue] Slack notify failed", {
        message: err.message,
        clientId,
        sheetRow,
      });
      return NextResponse.json(
        {
          error:
            "시트에는 반영되었으나 슬랙 알림 전송에 실패했습니다. SLACK_070_WEBHOOK_URL을 확인하고, 시트에서 행을 확인해 주세요.",
          sheetRow,
          partial: true,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "접수되었습니다. 콜게이트 담당자가 시트·슬랙을 확인한 뒤 CallCloud에 등록하고, 시트에서 진행 상태를 완료로 바꾸면 연동 완료로 동기화됩니다.",
      sheetRow,
    });
  } catch (err) {
    console.error("[070/request-queue] POST", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

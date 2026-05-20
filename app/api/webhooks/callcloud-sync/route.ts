import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { postSlack070C2wCompleteNotice } from "@/lib/integrations/slack-070-queue";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Google Apps Script (시트 onEdit) → CallLink DB 동기화
 * POST /api/webhooks/callcloud-sync
 *
 * Headers: x-api-key: <SHEET_SYNC_SECRET>
 * Body JSON: { clientId: string, status: string }
 *
 * status가 "완료" 또는 "completed"(대소문자 무관)일 때만
 * client_call_070_configs.callcloud_registered 와 clients.call_070_connected 를 true로 맞춤.
 */

function safeCompareSecrets(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function isCompleteStatus(status: unknown): boolean {
  if (typeof status !== "string") return false;
  const s = status.trim();
  if (s === "완료") return true;
  return s.toLowerCase() === "completed";
}

export async function POST(request: NextRequest) {
  const serverSecret = process.env.SHEET_SYNC_SECRET?.trim();
  if (!serverSecret) {
    console.error("[webhook/callcloud-sync] SHEET_SYNC_SECRET 미설정");
    return NextResponse.json(
      { error: "서버 설정 오류입니다." },
      { status: 503 }
    );
  }

  const apiKey = request.headers.get("x-api-key")?.trim() ?? "";
  if (!safeCompareSecrets(apiKey, serverSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { clientId, status } = body as { clientId?: unknown; status?: unknown };
  if (typeof clientId !== "string" || !clientId.trim()) {
    return NextResponse.json({ error: "clientId 필수" }, { status: 400 });
  }
  if (typeof status !== "string" || !status.trim()) {
    return NextResponse.json({ error: "status 필수" }, { status: 400 });
  }

  const id = clientId.trim();
  if (!isCompleteStatus(status)) {
    return NextResponse.json({
      ok: true,
      action: "ignored",
      reason: "status_not_complete",
    });
  }

  try {
    console.info("[webhook/callcloud-sync] 수신", {
      clientId: id.slice(0, 8) + "…",
      statusPreview: String(status).slice(0, 32),
    });

    const supabase = createServerSupabase();

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (clientErr) {
      console.error("[webhook/callcloud-sync] clients 조회 실패", clientErr);
      return NextResponse.json({ error: "DB 오류" }, { status: 500 });
    }
    if (!clientRow) {
      return NextResponse.json({ error: "거래처를 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: cfg, error: cfgErr } = await supabase
      .from("client_call_070_configs")
      .select("id, callcloud_registered")
      .eq("client_id", id)
      .maybeSingle();

    if (cfgErr) {
      console.error("[webhook/callcloud-sync] 070 config 조회 실패", cfgErr);
      return NextResponse.json({ error: "DB 오류" }, { status: 500 });
    }
    if (!cfg) {
      return NextResponse.json(
        {
          error:
            "070 연동 설정(client_call_070_configs)이 없습니다. 어드민에서 070 정보를 먼저 저장해 주세요.",
        },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    const wasAlreadyComplete = cfg.callcloud_registered === true;

    const { error: updCfgErr } = await supabase
      .from("client_call_070_configs")
      .update({ callcloud_registered: true, updated_at: now })
      .eq("client_id", id);

    if (updCfgErr) {
      console.error("[webhook/callcloud-sync] 070 config 업데이트 실패", updCfgErr);
      return NextResponse.json({ error: "DB 업데이트 실패" }, { status: 500 });
    }

    const { error: updClientErr } = await supabase
      .from("clients")
      .update({ call_070_connected: true })
      .eq("id", id);

    if (updClientErr) {
      console.error("[webhook/callcloud-sync] clients 업데이트 실패", updClientErr);
      return NextResponse.json({ error: "DB 업데이트 실패" }, { status: 500 });
    }

    console.info("[webhook/callcloud-sync] 반영 완료", {
      clientId: id.slice(0, 8) + "…",
      alreadyComplete: wasAlreadyComplete,
    });

    try {
      await postSlack070C2wCompleteNotice({ clientIdPrefix: id.slice(0, 8) });
    } catch (slackErr) {
      console.error("[webhook/callcloud-sync] C2W 완료 슬랙 알림 실패", slackErr);
    }

    return NextResponse.json({
      ok: true,
      action: "updated",
      clientId: id,
      alreadyComplete: wasAlreadyComplete,
    });
  } catch (e) {
    console.error("[webhook/callcloud-sync]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

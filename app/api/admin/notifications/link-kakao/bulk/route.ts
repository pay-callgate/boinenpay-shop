/**
 * 고객사 Link 안내 카카오 알림톡 — 대량 발송 (서버 순차 발송 + AlimtalkBulk 로그)
 */
import { randomBytes, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractIpFromRequest, logger } from "@/lib/logger";
import {
  logAlimtalkBulk,
  logAlimtalkBulkSummary,
} from "@/lib/alimtalk-bulk-logger";
import { prepareAlimtalkLinkMessage } from "@/lib/alimtalk-public-url";
import { sendKakaoAlimtalkAt } from "@/lib/msgagent-kakao";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_RECIPIENTS = 500;

function maskKoreanPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `***-****-${d.slice(-4)}`;
}

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

type Recipient = { phone: string; name?: string };

type Body = {
  partnerId?: string;
  clientId?: string;
  callback?: string;
  msg?: string;
  recipients?: Recipient[];
};

export async function POST(request: NextRequest) {
  const ip = extractIpFromRequest(request);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const partnerId = String(body.partnerId ?? "").trim();
    const clientId = String(body.clientId ?? "").trim();
    const callback = String(body.callback ?? "").replace(/\s/g, "");
    const msg = String(body.msg ?? "").trim();
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];

    if (!partnerId || !clientId) {
      return NextResponse.json(
        { ok: false, message: "partnerId, clientId가 필요합니다." },
        { status: 400 }
      );
    }
    if (!msg) {
      return NextResponse.json(
        { ok: false, message: "메시지가 필요합니다." },
        { status: 400 }
      );
    }
    if (recipients.length === 0) {
      return NextResponse.json(
        { ok: false, message: "수신자 목록이 비어 있습니다." },
        { status: 400 }
      );
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        {
          ok: false,
          message: `한 번에 최대 ${MAX_RECIPIENTS}건까지 발송할 수 있습니다.`,
        },
        { status: 400 }
      );
    }

    const prepared = prepareAlimtalkLinkMessage(msg);
    if (!prepared.ok) {
      return NextResponse.json({ ok: false, message: prepared.error }, { status: 422 });
    }
    const msgToSend = prepared.msg;
    if (prepared.rewritten) {
      logger.info("link_kakao_bulk_localhost_url_rewritten", {
        userId: session.user.id,
        action: "link_kakao_bulk",
        data: { partnerId, clientId },
      });
    }

    const supabase = createServerSupabase();

    const { data: adminRow } = await supabase
      .from("partner_admins")
      .select("partner_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!adminRow?.partner_id || adminRow.partner_id !== partnerId) {
      logger.warn("link_kakao_bulk_forbidden", {
        userId: session.user.id,
        path: request.nextUrl.pathname,
        data: { partnerId, ip },
      });
      return NextResponse.json(
        { ok: false, message: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("id, partner_id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr || !clientRow || clientRow.partner_id !== partnerId) {
      return NextResponse.json(
        { ok: false, message: "거래처를 찾을 수 없거나 소속이 아닙니다." },
        { status: 404 }
      );
    }

    const templateCode = process.env.MSGAGENT_TEMPLATE_CODE?.trim() ?? "";

    let success = 0;
    let failed = 0;
    const results: {
      phone: string;
      name?: string;
      ok: boolean;
      tranId?: string;
      error?: string;
    }[] = [];

    logAlimtalkBulk(
      "INFO",
      `대량 발송 시작 partnerId=${partnerId} clientId=${clientId} 건수=${recipients.length} ip=${ip}`
    );

    const batchId = randomUUID();

    for (let i = 0; i < recipients.length; i++) {
      const raw = recipients[i];
      const phone = String(raw?.phone ?? "").replace(/\s/g, "");
      const name = raw?.name?.trim() || undefined;

      if (!phone) {
        failed += 1;
        results.push({ phone: "", name, ok: false, error: "빈 번호" });
        logAlimtalkBulk(
          "ERROR",
          `발송결과 index=${i + 1} phone=(empty) name=${name ?? "-"} reason=empty_phone`
        );
        continue;
      }

      const tranId = randomBytes(14).toString("hex").slice(0, 29);
      const baseRow = {
        partner_id: partnerId,
        client_id: clientId,
        batch_id: batchId,
        recipient_name: name ?? null,
        requested_by_user_id: session.user.id,
        tran_id: tranId,
        phone_masked: maskKoreanPhone(phone),
        callback_masked: callback ? maskKoreanPhone(callback) : null,
        template_code: templateCode || null,
        msg_byte_length: utf8ByteLength(msgToSend.slice(0, 1000)),
        resolved_msg_preview: msgToSend.slice(0, 220),
      };

      try {
        const result = await sendKakaoAlimtalkAt({
          phone,
          callback: callback || undefined,
          msg: msgToSend,
          tranId,
        });

        const r =
          result.response &&
          typeof result.response === "object" &&
          !Array.isArray(result.response)
            ? (result.response as Record<string, unknown>)
            : null;

        const { error: insErr } = await supabase
          .from("link_kakao_notifications")
          .insert({
            ...baseRow,
            http_status: result.httpStatus,
            provider_ok: result.ok,
            result_code:
              r?.result_code !== undefined && r?.result_code !== null
                ? String(r.result_code)
                : null,
            cmid:
              r?.cmid !== undefined && r?.cmid !== null ? String(r.cmid) : null,
            error_message: result.ok
              ? null
              : `HTTP or 업체 응답: ${result.httpStatus}`,
            raw_response: r ?? { raw: result.response },
          });

        if (insErr) {
          logger.error("link_kakao_bulk_db_insert_failed", {
            userId: session.user.id,
            data: { error: insErr.message, tranId },
          });
        }

        if (result.ok) {
          success += 1;
          results.push({ phone, name, ok: true, tranId });
          logAlimtalkBulk(
            "INFO",
            `발송결과 index=${i + 1}/${recipients.length} phone=${maskKoreanPhone(phone)} name=${name ?? "-"} tranId=${tranId} http=${result.httpStatus} ok=true`
          );
        } else {
          failed += 1;
          results.push({
            phone,
            name,
            ok: false,
            tranId,
            error: `HTTP ${result.httpStatus}`,
          });
          logAlimtalkBulk(
            "ERROR",
            `발송결과 index=${i + 1}/${recipients.length} phone=${maskKoreanPhone(phone)} name=${name ?? "-"} tranId=${tranId} http=${result.httpStatus} ok=false`
          );
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        failed += 1;
        results.push({ phone, name, ok: false, error: message.slice(0, 200) });
        logAlimtalkBulk(
          "ERROR",
          `발송결과 index=${i + 1}/${recipients.length} phone=${maskKoreanPhone(phone)} name=${name ?? "-"} exception=${message.slice(0, 300)}`
        );

        const tranIdFallback = randomBytes(14).toString("hex").slice(0, 29);
        await supabase.from("link_kakao_notifications").insert({
          ...baseRow,
          tran_id: tranIdFallback,
          http_status: null,
          provider_ok: false,
          result_code: null,
          cmid: null,
          error_message: message.slice(0, 2000),
          raw_response: null,
        });
      }
    }

    logAlimtalkBulkSummary({
      attempted: recipients.length,
      success,
      failed,
    });

    logger.info("link_kakao_bulk_complete", {
      userId: session.user.id,
      data: { partnerId, clientId, attempted: recipients.length, success, failed, ip },
    });

    return NextResponse.json({
      ok: true,
      attempted: recipients.length,
      success,
      failed,
      results,
    });
  } catch (err) {
    logAlimtalkBulk(
      "ERROR",
      `라우트 예외: ${err instanceof Error ? err.message : String(err)}`
    );
    logger.error("link_kakao_bulk_route_error", {
      data: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { ok: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

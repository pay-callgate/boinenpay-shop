/**
 * 고객사 Link 안내 카카오 알림톡 발송.
 * DB: `lib/link-kakao-notifications-schema.ts` DDL 을 Supabase에 적용한 뒤 사용.
 */
import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger, extractIpFromRequest } from "@/lib/logger";
import {
  getMsgagentTemplateCodeForLinkKakao,
  resolveLinkKakaoAlimtalkCase,
} from "@/lib/alimtalk-link-template";
import { prepareAlimtalkLinkMessage } from "@/lib/alimtalk-public-url";
import {
  formatMsgagentWebshotFailureSummary,
  sendKakaoAlimtalkAt,
} from "@/lib/msgagent-kakao";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

function maskKoreanPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `***-****-${d.slice(-4)}`;
}

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

type Body = {
  partnerId?: string;
  clientId?: string;
  phone?: string;
  callback?: string;
  msg?: string;
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
    const phone = String(body.phone ?? "").replace(/\s/g, "");
    const callback = String(body.callback ?? "").replace(/\s/g, "");
    const msg = String(body.msg ?? "").trim();

    if (!partnerId || !clientId) {
      return NextResponse.json(
        { ok: false, message: "partnerId, clientId가 필요합니다." },
        { status: 400 }
      );
    }
    if (!phone) {
      return NextResponse.json(
        { ok: false, message: "수신번호가 필요합니다." },
        { status: 400 }
      );
    }
    if (!msg) {
      return NextResponse.json(
        { ok: false, message: "메시지가 필요합니다." },
        { status: 400 }
      );
    }

    const prepared = prepareAlimtalkLinkMessage(msg);
    if (!prepared.ok) {
      return NextResponse.json({ ok: false, message: prepared.error }, { status: 422 });
    }
    const msgToSend = prepared.msg;
    if (prepared.rewritten) {
      logger.info("link_kakao_localhost_url_rewritten", {
        userId: session.user.id,
        action: "link_kakao",
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
      logger.warn("link_kakao_forbidden", {
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

    const alimtalkCase = await resolveLinkKakaoAlimtalkCase(supabase, clientId);
    const templateCode = getMsgagentTemplateCodeForLinkKakao(alimtalkCase);
    if (!templateCode) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "MSGAGENT_TEMPLATE_CODE_C1(링크만)이 비었습니다. .env에 설정하거나, 레거시 MSGAGENT_TEMPLATE_CODE를 넣어 주세요.",
        },
        { status: 500 }
      );
    }

    const tranId = randomBytes(14).toString("hex").slice(0, 29);

    const baseRow = {
      partner_id: partnerId,
      client_id: clientId,
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
        templateCode,
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
            : formatMsgagentWebshotFailureSummary(result).slice(0, 2000),
          raw_response: r ?? { raw: result.response },
        });

      if (insErr) {
        logger.error("link_kakao_db_insert_failed", {
          userId: session.user.id,
          data: { error: insErr.message, tranId },
        });
      }

      logger.info("link_kakao_send_complete", {
        userId: session.user.id,
        action: "link_kakao",
        data: {
          partnerId,
          clientId,
          tranId,
          providerOk: result.ok,
          httpStatus: result.httpStatus,
          resultCode: result.resultCode,
          ip,
        },
      });

      if (!result.ok) {
        return NextResponse.json(
          {
            ok: false,
            message: "알림톡 접수에 실패했습니다. 로그·업체 응답을 확인해 주세요.",
            tranId,
            response: result.response,
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        ok: true,
        tranId,
        response: result.response,
        resolvedMsg: result.resolvedMsg,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const { error: insErr } = await supabase
        .from("link_kakao_notifications")
        .insert({
          ...baseRow,
          http_status: null,
          provider_ok: false,
          result_code: null,
          cmid: null,
          error_message: message.slice(0, 2000),
          raw_response: null,
        });

      if (insErr) {
        logger.error("link_kakao_db_insert_failed_after_error", {
          userId: session.user.id,
          data: { error: insErr.message, tranId },
        });
      }

      logger.error("link_kakao_send_failed", {
        userId: session.user.id,
        data: { partnerId, clientId, tranId, message, ip },
      });

      return NextResponse.json(
        { ok: false, message, tranId },
        { status: 502 }
      );
    }
  } catch (err) {
    logger.error("link_kakao_route_error", {
      data: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { ok: false, message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/messages/reports/sync
 * 미확정(pending) 알림톡 건의 벤더 최종 리포트를 조회해 DB에 반영합니다.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  LINK_KAKAO_REPORT_SYNC_DEFAULT_LIMIT,
  syncPendingLinkKakaoReportsForPartner,
} from "@/lib/link-kakao-report-sync";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  from?: string;
  to?: string;
  limit?: number;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const from = body.from?.trim() || null;
    const to = body.to?.trim() || null;
    const limitRaw = Number(body.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.floor(limitRaw)), 100)
      : LINK_KAKAO_REPORT_SYNC_DEFAULT_LIMIT;

    const supabase = createServerSupabase();
    const { data: adminRow } = await supabase
      .from("partner_admins")
      .select("partner_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!adminRow?.partner_id) {
      return NextResponse.json(
        { ok: false, message: "파트너 권한이 없습니다." },
        { status: 403 }
      );
    }

    const partnerId = adminRow.partner_id as string;

    const result = await syncPendingLinkKakaoReportsForPartner(
      supabase,
      partnerId,
      { from, to, limit }
    );

    logger.info("link_kakao_report_sync", {
      userId: session.user.id,
      data: { partnerId, ...result },
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e) {
    console.error("[POST /api/admin/messages/reports/sync]", e);
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "리포트 동기화에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}

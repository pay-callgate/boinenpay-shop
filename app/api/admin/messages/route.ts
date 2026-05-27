import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  fetchAdminAlimtalkGroupedListForPartner,
  parseAdminAlimtalkListStatus,
} from "@/lib/admin-alimtalk-messages-fetch";
import {
  summarizeAlimtalkChannelTotals,
  summarizeAlimtalkSettlement,
} from "@/lib/admin-alimtalk-messages";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/messages
 * 쿼리: from=YYYY-MM-DD, to=YYYY-MM-DD, status=all|completed|scheduled|sending|failed, q=검색어, page=1, pageSize=10
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

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
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = parseAdminAlimtalkListStatus(searchParams.get("status"));
    const q = searchParams.get("q") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(5, parseInt(searchParams.get("pageSize") ?? "10", 10) || 10)
    );

    const { rows: filtered, dbError } =
      await fetchAdminAlimtalkGroupedListForPartner(supabase, partnerId, {
        from,
        to,
        status,
        q,
      });

    if (dbError) {
      console.error("[GET /api/admin/messages] link_kakao_notifications", dbError);
      const detail = dbError.message?.trim();
      const isDev = process.env.NODE_ENV !== "production";
      return NextResponse.json(
        {
          ok: false,
          message: isDev && detail
            ? `발송 내역 조회 실패: ${detail}`
            : "발송 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: 500 }
      );
    }

    const { totalSuccessCount, totalFailCount, estimatedSettlementWon } =
      summarizeAlimtalkSettlement(filtered);
    const channelTotals = summarizeAlimtalkChannelTotals(filtered);

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      ok: true,
      data: {
        items,
        page,
        pageSize,
        total,
        summary: {
          totalSuccessCount,
          totalFailCount,
          unitWon: 4,
          estimatedSettlementWon,
          kakaoSuccess: channelTotals.kakaoSuccess,
          kakaoFail: channelTotals.kakaoFail,
          smsSuccess: channelTotals.smsSuccess,
          smsFail: channelTotals.smsFail,
        },
      },
    });
  } catch (e) {
    console.error("[GET /api/admin/messages]", e);
    return NextResponse.json(
      { ok: false, message: "서버 오류" },
      { status: 500 }
    );
  }
}

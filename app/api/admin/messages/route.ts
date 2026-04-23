import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  ADMIN_ALIMTALK_MESSAGES_STUB,
  filterAdminAlimtalkRows,
  summarizeAlimtalkSettlement,
  type AdminAlimtalkHistoryStatus,
  type AdminAlimtalkMessageRow,
} from "@/lib/admin-alimtalk-messages";

export const dynamic = "force-dynamic";

function parseStatus(v: string | null): AdminAlimtalkHistoryStatus | "all" {
  if (
    v === "completed" ||
    v === "scheduled" ||
    v === "sending" ||
    v === "failed"
  ) {
    return v;
  }
  return "all";
}

/**
 * GET /api/admin/messages
 * 쿼리: from=YYYY-MM-DD, to=YYYY-MM-DD, status=all|completed|scheduled|sending|failed, q=검색어, page=1, pageSize=10
 *
 * 현재: 스텁 데이터 + 세션 파트너 기준 필터·페이징.
 * TODO: link_kakao_notifications (또는 집계 테이블) 조회로 교체.
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
    const status = parseStatus(searchParams.get("status"));
    const q = searchParams.get("q") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      50,
      Math.max(5, parseInt(searchParams.get("pageSize") ?? "10", 10) || 10)
    );

    const stubRows: AdminAlimtalkMessageRow[] = ADMIN_ALIMTALK_MESSAGES_STUB.map(
      (r) => ({ ...r, partnerId })
    );

    // TODO: const { data: dbRows } = await supabase.from("link_kakao_notifications")...
    // const rows = dbRows?.length ? mapDbToRows(dbRows) : stubRows;
    const rows = stubRows;

    const filtered = filterAdminAlimtalkRows(rows, {
      fromIso: from,
      toIso: to,
      status,
      q,
    });

    const { totalSuccessCount, estimatedSettlementWon } =
      summarizeAlimtalkSettlement(filtered);

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
          unitWon: 4,
          estimatedSettlementWon,
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

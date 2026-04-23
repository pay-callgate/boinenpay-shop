import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import {
  fetchAdminAlimtalkRawExportRowsForPartner,
  parseAdminAlimtalkListStatus,
} from "@/lib/admin-alimtalk-messages-fetch";
import { ADMIN_ALIMTALK_STATUS_LABEL } from "@/lib/admin-alimtalk-messages";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/messages/export
 * 필터(from, to, status, q)는 목록과 동일하나, 행은 그룹화하지 않고 수신자(DB 로우) 1건당 1행(정산용 raw).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const supabase = createServerSupabase();
    const { data: adminRow } = await supabase
      .from("partner_admins")
      .select("partner_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!adminRow?.partner_id) {
      return NextResponse.json({ error: "파트너 권한이 없습니다." }, { status: 403 });
    }

    const partnerId = adminRow.partner_id as string;
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = parseAdminAlimtalkListStatus(searchParams.get("status"));
    const q = searchParams.get("q") ?? "";

    const { rows, dbError } = await fetchAdminAlimtalkRawExportRowsForPartner(
      supabase,
      partnerId,
      { from, to, status, q }
    );

    if (dbError) {
      console.error("[GET /api/admin/messages/export]", dbError);
      return NextResponse.json({ error: "발송 내역 조회에 실패했습니다." }, { status: 500 });
    }

    const excelData = rows.map((r) => ({
      발송일시: new Date(r.sentAt).toLocaleString("ko-KR"),
      거래처명: r.clientName,
      수신자표시: r.recipientName,
      수신번호: r.recipientPhone,
      제목: r.title,
      내용요약: r.body.replace(/\r?\n/g, " ").slice(0, 500),
      상태: ADMIN_ALIMTALK_STATUS_LABEL[r.status],
      총건수: r.totalCount,
      성공: r.successCount,
      실패: r.failCount,
      발신번호: r.senderPhone,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "알림톡발송내역");

    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 10 },
      { wch: 16 },
      { wch: 18 },
      { wch: 50 },
      { wch: 10 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 16 },
    ];

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `alimtalk_messages_${today}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/messages/export]", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

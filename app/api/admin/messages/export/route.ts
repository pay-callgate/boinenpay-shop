import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { buildAlimtalkExcelRowWithIds } from "@/lib/admin-alimtalk-export";
import {
  fetchAdminAlimtalkExcelRowsForPartner,
  parseAdminAlimtalkListStatus,
} from "@/lib/admin-alimtalk-messages-fetch";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/messages/export
 * 필터(from, to, status, q)는 목록과 동일.
 * 행은 수신자(DB) 1건당 1행 — 목록의 배치 합산 행과 건수가 다를 수 있음.
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

    const { rows, dbError } = await fetchAdminAlimtalkExcelRowsForPartner(
      supabase,
      partnerId,
      { from, to, status, q }
    );

    if (dbError) {
      console.error("[GET /api/admin/messages/export]", dbError);
      return NextResponse.json({ error: "발송 내역 조회에 실패했습니다." }, { status: 500 });
    }

    const excelData = rows.map(({ db, clientName }) =>
      buildAlimtalkExcelRowWithIds(db, clientName)
    );

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "알림톡발송내역");

    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 10 },
      { wch: 38 },
      { wch: 10 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 10 },
      { wch: 16 },
      { wch: 10 },
      { wch: 28 },
      { wch: 10 },
      { wch: 28 },
      { wch: 40 },
      { wch: 8 },
      { wch: 8 },
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 50 },
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

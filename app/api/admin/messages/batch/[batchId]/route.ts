import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { LINK_KAKAO_NOTIFICATION_LIST_SELECT } from "@/lib/admin-alimtalk-messages-fetch";
import type { LinkKakaoNotificationDbRow } from "@/lib/admin-alimtalk-messages";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/messages/batch/[batchId]
 * 대량 발송(batch)에 속한 수신자별 목록 (모달 수신자 탭).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { batchId } = await context.params;
    const bid = String(batchId ?? "").trim();
    if (!bid) {
      return NextResponse.json(
        { ok: false, message: "batchId가 필요합니다." },
        { status: 400 }
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

    const { data: rows, error } = await supabase
      .from("link_kakao_notifications")
      .select(LINK_KAKAO_NOTIFICATION_LIST_SELECT)
      .eq("partner_id", partnerId)
      .eq("batch_id", bid)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[GET /api/admin/messages/batch]", error);
      return NextResponse.json(
        { ok: false, message: "조회에 실패했습니다." },
        { status: 500 }
      );
    }

    const recipients = (rows ?? []).map((r) => {
      const row = r as LinkKakaoNotificationDbRow;
      const rc =
        row.result_code != null && String(row.result_code).trim() !== ""
          ? String(row.result_code).trim()
          : null;
      const err =
        row.error_message != null && String(row.error_message).trim() !== ""
          ? String(row.error_message).trim()
          : null;
      return {
        id: r.id as string,
        recipientName:
          String(row.recipient_name ?? "").trim() || "-",
        recipientPhone: String(row.phone_masked ?? ""),
        success: !!row.provider_ok,
        resultCode: rc,
        errorMessage: err,
      };
    });

    return NextResponse.json({
      ok: true,
      data: { recipients },
    });
  } catch (e) {
    console.error("[GET /api/admin/messages/batch]", e);
    return NextResponse.json(
      { ok: false, message: "서버 오류" },
      { status: 500 }
    );
  }
}

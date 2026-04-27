import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { UserClientRole } from "@/types/user-client";

export const dynamic = "force-dynamic";

/**
 * 알림톡·전용몰 URL 기준 소속 자동 바인딩
 * POST /api/shop/auth/bind-client
 * body: { partnerId: string, clientSlug: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const partnerId = String(body.partnerId ?? "").trim();
    const clientSlug = String(body.clientSlug ?? "").trim();

    if (!partnerId || !clientSlug || clientSlug === "_preview") {
      return NextResponse.json(
        { success: false, error: "partnerId와 유효한 clientSlug가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: clientRow, error: clientErr } = await supabase
      .from("clients")
      .select("id, partner_id, slug")
      .eq("slug", clientSlug)
      .eq("partner_id", partnerId)
      .maybeSingle();

    if (clientErr || !clientRow) {
      return NextResponse.json(
        { success: false, error: "거래처를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const targetClientId = clientRow.id as string;

    const { data: existing, error: exErr } = await supabase
      .from("user_clients")
      .select("user_id, client_id, role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (exErr) {
      console.error("[bind-client] existing lookup", exErr);
      return NextResponse.json({ success: false, error: "조회 실패" }, { status: 500 });
    }

    if (existing) {
      if (existing.client_id === targetClientId) {
        console.log("[bind-client] already bound same client", {
          userId: session.user.id,
          clientId: targetClientId,
        });
        return NextResponse.json({ success: true, alreadyBound: true });
      }
      console.warn("[bind-client] conflict — other client already bound", {
        userId: session.user.id,
        existingClientId: existing.client_id,
        targetClientId,
      });
      return NextResponse.json(
        {
          success: false,
          code: "AFFILIATION_CONFLICT",
          error: "이미 다른 거래처에 소속되어 있습니다.",
        },
        { status: 409 }
      );
    }

    const insertRole: UserClientRole = "member";
    const { error: insErr } = await supabase.from("user_clients").insert({
      user_id: session.user.id,
      client_id: targetClientId,
      role: insertRole,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        const { data: afterRace } = await supabase
          .from("user_clients")
          .select("client_id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (afterRace?.client_id === targetClientId) {
          return NextResponse.json({ success: true, alreadyBound: true });
        }
        return NextResponse.json(
          { success: false, code: "AFFILIATION_CONFLICT", error: "소속 정보가 이미 있습니다." },
          { status: 409 }
        );
      }
      /** DB 리셋 등으로 세션 user.id가 users에 없을 때 FK 위반 — 재로그인 필요 */
      if (insErr.code === "23503") {
        return NextResponse.json(
          {
            success: false,
            code: "STALE_SESSION",
            error:
              "로그인 정보가 더 이상 유효하지 않습니다. 다시 로그인한 뒤 이용해 주세요.",
          },
          { status: 401 }
        );
      }
      console.error("[bind-client] insert", insErr);
      return NextResponse.json({ success: false, error: "소속 등록 실패" }, { status: 500 });
    }

    console.log("[bind-client] inserted", { userId: session.user.id, clientId: targetClientId });
    return NextResponse.json({ success: true, alreadyBound: false });
  } catch (e) {
    console.error("[bind-client]", e);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

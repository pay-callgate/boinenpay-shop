import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildFloristSearchUrlForServer,
  buildOptionSearchUrlForServer,
  buildProductSearchUrlForServer,
} from "@/lib/newrun/server-search-urls";
import { getRequestAppOrigin } from "@/lib/newrun/request-app-origin";
import type { NewrunCallbackKind } from "@/lib/newrun/constants";
import { NEWRUN_CALLBACK_PATHS } from "@/lib/newrun/constants";

export const dynamic = "force-dynamic";

const VALID = new Set<string>(Object.keys(NEWRUN_CALLBACK_PATHS));

function isKind(s: string): s is NewrunCallbackKind {
  return VALID.has(s);
}

/**
 * 파트너 어드민 전용: 협회 member_ext 수주화원·상품·옵션 검색 URL (rose_session + var_ret 포함)
 * GET /api/partner/integrations/newrun/search-url?kind=florist|product|option&orderId=uuid
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const kindRaw = request.nextUrl.searchParams.get("kind") ?? "";
    if (!isKind(kindRaw)) {
      return NextResponse.json(
        { error: "kind는 florist, product, option 중 하나여야 합니다." },
        { status: 400 }
      );
    }

    const orderId = request.nextUrl.searchParams.get("orderId")?.trim() || null;

    const supabase = createServerSupabase();

    const { data: adminRows, error: adminErr } = await supabase
      .from("partner_admins")
      .select("partner_id")
      .eq("user_id", session.user.id);

    if (adminErr || !adminRows?.length) {
      return NextResponse.json({ error: "파트너 관리자 권한이 없습니다." }, { status: 403 });
    }

    const partnerIds = adminRows.map((r) => r.partner_id as string);

    if (orderId) {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("partner_id")
        .eq("id", orderId)
        .maybeSingle();

      if (orderErr || !order) {
        return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
      }
      if (!partnerIds.includes(order.partner_id as string)) {
        return NextResponse.json({ error: "해당 주문에 대한 권한이 없습니다." }, { status: 403 });
      }
    }

    const origin = getRequestAppOrigin(request);
    if (!origin) {
      return NextResponse.json(
        {
          error:
            "앱 URL을 알 수 없습니다. NEXT_PUBLIC_APP_URL을 설정하거나 올바른 Host 헤더로 요청해 주세요.",
        },
        { status: 400 }
      );
    }

    let url: string;
    try {
      if (kindRaw === "florist") {
        url = buildFloristSearchUrlForServer(origin);
      } else if (kindRaw === "product") {
        url = buildProductSearchUrlForServer(origin);
      } else {
        url = buildOptionSearchUrlForServer(origin);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "URL 생성에 실패했습니다.";
      console.error("[Newrun:search-url]", msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ url, kind: kindRaw });
  } catch (err) {
    console.error("[Newrun:search-url] error", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

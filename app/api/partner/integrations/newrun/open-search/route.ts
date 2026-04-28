import { NextRequest, NextResponse } from "next/server";
import { resolvePartnerNewrunNeuronSearchUrl } from "@/lib/newrun/partner-search-url-access";

export const dynamic = "force-dynamic";

/**
 * 협회 뉴런 검색(HTTP) 진입 — 브라우저는 동일 출처(HTTPS)만 연 뒤 서버가 302로 neuron URL 이동.
 * Mixed Content(fetch/iframe로 http 직접 호출) 및 팝업 정책 이슈를 줄이기 위한 진입점.
 *
 * GET /api/partner/integrations/newrun/open-search?kind=florist|product|option&orderId=uuid (orderId 선택)
 */
export async function GET(request: NextRequest) {
  try {
    const resolved = await resolvePartnerNewrunNeuronSearchUrl(request);
    if (!resolved.ok) {
      const res = resolved.response;
      if (res.status === 401) {
        const login = new URL("/admin/login", request.nextUrl.origin);
        login.searchParams.set(
          "callbackUrl",
          `${request.nextUrl.pathname}${request.nextUrl.search}`
        );
        return NextResponse.redirect(login);
      }
      return res;
    }
    return NextResponse.redirect(resolved.neuronUrl, 302);
  } catch (err) {
    console.error("[Newrun:open-search] error", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

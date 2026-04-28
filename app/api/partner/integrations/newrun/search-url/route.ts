import { NextRequest, NextResponse } from "next/server";
import { resolvePartnerNewrunNeuronSearchUrl } from "@/lib/newrun/partner-search-url-access";

export const dynamic = "force-dynamic";

/**
 * 파트너 어드민 전용: 협회 member_ext 수주화원·상품·옵션 검색 URL (rose_session + var_ret 포함)
 * GET /api/partner/integrations/newrun/search-url?kind=florist|product|option&orderId=uuid
 */
export async function GET(request: NextRequest) {
  try {
    const resolved = await resolvePartnerNewrunNeuronSearchUrl(request);
    if (!resolved.ok) return resolved.response;
    return NextResponse.json({ url: resolved.neuronUrl, kind: resolved.kind });
  } catch (err) {
    console.error("[Newrun:search-url] error", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

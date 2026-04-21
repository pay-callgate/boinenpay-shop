/**
 * intranet_post 응답에서 rwr_* 추출 (HTML 본문·Location 쿼리 등 혼합 대비).
 * 뉴런·게이트웨이 실측 후 패턴 보강.
 */

function extractFromText(text: string): { rwr_result?: string; rwr_orderkey?: string } {
  const rResult =
    text.match(/rwr_result["']?\s*[=:]\s*["']?(\d+)/i)?.[1] ??
    text.match(/[&?]rwr_result=(\d+)/i)?.[1];
  const rKey =
    text.match(/rwr_orderkey["']?\s*[=:]\s*["']?([^&"'<>\s]+)/i)?.[1] ??
    text.match(/[&?]rwr_orderkey=([^&\s]+)/i)?.[1];
  return {
    rwr_result: rResult,
    rwr_orderkey: rKey ? decodeURIComponent(rKey.replace(/\+/g, " ")) : undefined,
  };
}

export function parseIntranetPostResponse(args: {
  status: number;
  bodyText: string;
  locationHeader: string | null;
}): { rwr_result?: string; rwr_orderkey?: string } {
  const fromBody = extractFromText(args.bodyText);
  const loc = args.locationHeader?.trim() ?? "";
  const fromLoc = loc ? extractFromText(loc) : {};
  return {
    rwr_result: fromBody.rwr_result ?? fromLoc.rwr_result,
    rwr_orderkey: fromBody.rwr_orderkey ?? fromLoc.rwr_orderkey,
  };
}

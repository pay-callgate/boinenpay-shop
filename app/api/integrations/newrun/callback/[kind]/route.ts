import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseNewrunVarRetRequest, collectVarRetSearchFragments } from "@/lib/newrun/callback-request";
import type { NewrunCallbackKind } from "@/lib/newrun/constants";
import { NEWRUN_CALLBACK_PATHS } from "@/lib/newrun/constants";

export const dynamic = "force-dynamic";

const VALID_KINDS = new Set<string>(Object.keys(NEWRUN_CALLBACK_PATHS));

function isKind(s: string): s is NewrunCallbackKind {
  return VALID_KINDS.has(s);
}

function wantsJson(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  const fmt = request.nextUrl.searchParams.get("format");
  return accept.includes("application/json") || fmt === "json";
}

function htmlResponse(
  kind: NewrunCallbackKind,
  query: Record<string, string>,
  body: Record<string, string> | null
): NextResponse {
  const payload = { ...query, ...(body ?? {}) };
  const safe = JSON.stringify(payload);
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>뉴런 연동 — 선택 반영</title>
</head>
<body>
  <p style="font-family:sans-serif;padding:1rem;">선택 정보가 전달되었습니다. 이 창을 닫아 주세요.</p>
  <script>
    (function () {
      var payload = ${safe};
      var kind = ${JSON.stringify(kind)};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "NEWRUN_VAR_RET", kind: kind, payload: payload },
            window.location.origin
          );
        }
      } catch (e) {
        console.warn("[Newrun var_ret] postMessage failed", e);
      }
    })();
  </script>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function handle(
  request: NextRequest,
  kind: NewrunCallbackKind
): Promise<NextResponse> {
  const fragments = collectVarRetSearchFragments(request);
  const incomingRequestUrl =
    request.url.length > 2048 ? `${request.url.slice(0, 2048)}…` : request.url;
  const joinedSearch = fragments.join(" || ");
  const incomingSearchRaw =
    joinedSearch.length > 4096 ? `${joinedSearch.slice(0, 4096)}…` : joinedSearch || null;

  const { query, body } = await parseNewrunVarRetRequest(request);
  const method = request.method;

  console.log("[Newrun:var_ret]", kind, method, {
    incomingPreview: incomingRequestUrl.slice(0, 180),
    fragmentCount: fragments.length,
    queryKeys: Object.keys(query),
  });

  let rowId: string | null = null;
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("newrun_callback_results")
      .insert({
        kind,
        method,
        raw_query: query,
        raw_body: body,
        incoming_request_url: incomingRequestUrl,
        incoming_search_raw: incomingSearchRaw,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Newrun:var_ret] DB insert failed", error);
      if (wantsJson(request)) {
        return NextResponse.json(
          { success: false, error: "저장에 실패했습니다." },
          { status: 500 }
        );
      }
      return new NextResponse(
        "<!DOCTYPE html><html><body><p>저장 실패. 관리자에게 문의해 주세요.</p></body></html>",
        { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    rowId = data?.id ?? null;
  } catch (e) {
    console.error("[Newrun:var_ret] Supabase unavailable", e);
    if (wantsJson(request)) {
      return NextResponse.json(
        { success: false, error: "서버 설정을 확인해 주세요." },
        { status: 500 }
      );
    }
    return new NextResponse(
      "<!DOCTYPE html><html><body><p>서버 오류입니다.</p></body></html>",
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (wantsJson(request)) {
    return NextResponse.json({
      success: true,
      id: rowId,
      kind,
      query,
      body,
    });
  }

  return htmlResponse(kind, query, body);
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ kind: string }> }
) {
  const { kind: raw } = await ctx.params;
  if (!isKind(raw)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 404 });
  }
  return handle(request, raw);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ kind: string }> }
) {
  const { kind: raw } = await ctx.params;
  if (!isKind(raw)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 404 });
  }
  return handle(request, raw);
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ kind: string }> }
) {
  const { kind: raw } = await ctx.params;
  if (!isKind(raw)) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(null, { status: 200 });
}

import { NextRequest, NextResponse } from "next/server";
import { applyNewrunPoReturnFromSearchParams } from "@/lib/newrun/apply-po-return";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 뉴런 `rw_returnurl` 브라우저 착지 — 운영 경로 예시:
 * `https://www.calllinkshop.com/wooribugo/wooribu/newrun/po-return`
 */
function urlSearchParamsToRaw(
  sp: URLSearchParams
): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(sp.keys())) {
    const all = sp.getAll(key);
    out[key] = all.length === 1 ? all[0]! : all;
  }
  return out;
}

async function parsePostMerged(
  request: NextRequest,
  queryRaw: Record<string, string | string[] | undefined>
): Promise<Record<string, string | string[] | undefined>> {
  const ct = (request.headers.get("content-type") ?? "").toLowerCase();
  const out: Record<string, string | string[] | undefined> = { ...queryRaw };
  try {
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await request.formData();
      for (const [k, v] of fd.entries()) {
        if (typeof v !== "string") continue;
        const prev = out[k];
        if (prev === undefined) out[k] = v;
        else if (Array.isArray(prev)) prev.push(v);
        else out[k] = [prev, v];
      }
      return out;
    }
    if (ct.includes("application/json")) {
      const j = (await request.json()) as Record<string, unknown>;
      for (const [k, val] of Object.entries(j)) {
        if (val == null) continue;
        out[k] = typeof val === "string" ? val : String(val);
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function handlePoReturn(request: NextRequest): Promise<Response> {
  const queryRaw = urlSearchParamsToRaw(request.nextUrl.searchParams);
  const merged =
    request.method === "POST"
      ? await parsePostMerged(request, queryRaw)
      : queryRaw;

  let apply: Awaited<ReturnType<typeof applyNewrunPoReturnFromSearchParams>>;
  try {
    const supabase = createServerSupabase();
    apply = await applyNewrunPoReturnFromSearchParams(supabase, merged);
  } catch {
    apply = {
      kind: "skipped",
      reason: "db_error",
      message: "일시적으로 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  const title =
    apply.kind === "applied" && apply.rwr_result === "0"
      ? "발주 반영 완료"
      : apply.kind === "applied"
        ? "발주 결과 수신"
        : "발주 리턴";

  const sub =
    apply.kind === "applied" ? `${apply.headline} — ${apply.detail}` : apply.message;

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;padding:1.5rem;line-height:1.5"><h1 style="font-size:1.125rem">${escapeHtml(title)}</h1><p>${escapeHtml(sub)}</p><p style="margin-top:2rem;font-size:0.8rem;color:#888">이 창을 닫아도 됩니다.</p></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  return handlePoReturn(request);
}

export async function POST(request: NextRequest) {
  return handlePoReturn(request);
}

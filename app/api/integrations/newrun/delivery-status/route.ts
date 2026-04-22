import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  mergeNewrunDeliveryParams,
  processNewrunDeliveryCallback,
} from "@/lib/newrun/delivery-status-callback";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const JSON_OK = NextResponse.json({ success: true }, { status: 200 });

function queryRecordFromUrl(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

async function parsePostBody(request: NextRequest): Promise<Record<string, unknown>> {
  const ct = (request.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const j = await request.json();
      return j != null && typeof j === "object" && !Array.isArray(j)
        ? (j as Record<string, unknown>)
        : {};
    }
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await request.formData();
      const out: Record<string, unknown> = {};
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
    const text = await request.text();
    if (!text.trim()) return {};
    try {
      const j = JSON.parse(text) as unknown;
      if (j != null && typeof j === "object" && !Array.isArray(j)) {
        return j as Record<string, unknown>;
      }
    } catch {
      /* fallthrough */
    }
    return { raw: text };
  } catch (e) {
    logger.warn("[Newrun:delivery-status] body parse failed", {
      action: "newrun_delivery_body_parse",
      data: { message: e instanceof Error ? e.message : String(e) },
    });
    return {};
  }
}

/**
 * 뉴런시스템(Newrun) 배송결과 콜백 (문서 2.6)
 * 성공·실패와 무관하게 항상 200 + { success: true } (재시도 폭주 방지)
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const query = queryRecordFromUrl(url);
  const params = mergeNewrunDeliveryParams(query, null);
  logger.info("[Newrun:delivery-status] GET", {
    action: "newrun_delivery_get",
    data: { keys: Object.keys(params) },
  });

  try {
    const supabase = createServerSupabase();
    await processNewrunDeliveryCallback(supabase, params);
  } catch (e) {
    logger.error("[Newrun:delivery-status] GET handler", {
      action: "newrun_delivery_get_error",
      data: { message: e instanceof Error ? e.message : String(e) },
    });
  }
  return JSON_OK;
}

export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  const query = queryRecordFromUrl(url);
  const body = await parsePostBody(request);
  const params = mergeNewrunDeliveryParams(query, body);
  logger.info("[Newrun:delivery-status] POST", {
    action: "newrun_delivery_post",
    data: { keys: Object.keys(params) },
  });

  try {
    const supabase = createServerSupabase();
    await processNewrunDeliveryCallback(supabase, params);
  } catch (e) {
    logger.error("[Newrun:delivery-status] POST handler", {
      action: "newrun_delivery_post_error",
      data: { message: e instanceof Error ? e.message : String(e) },
    });
  }
  return JSON_OK;
}

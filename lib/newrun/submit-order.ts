import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  mapOrderToNewrunPayload,
  NewrunPayloadValidationError,
  type NewrunIntranetCredentials,
} from "@/lib/newrun/map-order-to-newrun-payload";
import {
  mergeFloristDraftForOrder,
  mergeProductDraftForOrder,
} from "@/lib/newrun/merge-order-drafts";
import { encodeNewrunIntranetPostBody } from "@/lib/newrun/euc-kr-wire";
import { readIntranetPostResponseBodyText } from "@/lib/newrun/intranet-post-response-body";
import { parseIntranetPostResponse } from "@/lib/newrun/parse-intranet-post-response";
import { appendNewrunPoReturnTokenToReturnUrl } from "@/lib/newrun/po-return-signing";
import { fireNewrunErrorWebhook } from "@/lib/newrun/error-webhook";

const LOG = "[Newrun:Submit]";

function hookSubmitFailure(orderNo: string, orderId: string, errorCode: string, errorMessage: string) {
  fireNewrunErrorWebhook({
    order_no: orderNo.trim() || orderId,
    error_code: errorCode.slice(0, 64),
    error_message: errorMessage,
    timestamp: new Date().toISOString(),
  });
}

const DEFAULT_INTRANET_POST_URL = "http://ext2intra.roseweb.co.kr/intranet_post.html";

export type NewrunSubmitSource = "viewpay_complete" | "admin_manual";

export type SubmitNewrunOrderResult = {
  ok: boolean;
  skipped: boolean;
  duplicate: boolean;
  rwr_result?: string;
  rwr_orderkey?: string;
  message: string;
  warnings?: string[];
};

export function getNewrunCredentialsFromEnv(): NewrunIntranetCredentials | null {
  const rw_rosewebid = process.env.NEWRUN_ROSEWEB_ID?.trim() ?? "";
  const rw_rosewebpw = process.env.NEWRUN_ROSEWEB_PW?.trim() ?? "";
  const rw_returnurl = process.env.NEWRUN_RW_RETURNURL?.trim() ?? "";
  const rw_assoc =
    process.env.NEWRUN_ASSOC_CODE?.trim() || process.env.NEWRUN_ASSOC_INTRANET_ID?.trim() || "";
  const rw_associd = process.env.NEWRUN_RW_ASSOCID?.trim() ?? "";
  if (!rw_rosewebid || !rw_rosewebpw || !rw_returnurl) return null;
  return { rw_rosewebid, rw_rosewebpw, rw_assoc, rw_associd, rw_returnurl };
}

function intranetPostUrl(): string {
  return (process.env.NEWRUN_INTRANET_POST_URL ?? DEFAULT_INTRANET_POST_URL).trim();
}

function isTruthyEnv(v: string | undefined): boolean {
  return v === "1" || v?.toLowerCase() === "true";
}

async function loadSubmitContext(supabase: SupabaseClient, orderId: string) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      *,
      client:clients (
        id,
        newrun_default_florist_draft
      )
    `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return { error: "주문을 찾을 수 없습니다." as const, order: null, items: null };
  }

  const { data: items } = await supabase
    .from("order_items")
    .select(
      `
      quantity,
      product_name,
      product:products (
        newrun_default_product_draft,
        newrun_default_option_draft
      )
    `
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  const rowItems = items ?? [];
  const first = rowItems[0]?.product as
    | {
        newrun_default_product_draft?: Record<string, unknown> | null;
        newrun_default_option_draft?: Record<string, unknown> | null;
      }
    | null
    | undefined;

  const florist = mergeFloristDraftForOrder(
    order.client?.newrun_default_florist_draft as Record<string, unknown> | null | undefined,
    order.newrun_florist_draft as Record<string, unknown> | null | undefined
  );
  const product = mergeProductDraftForOrder(
    first?.newrun_default_product_draft,
    order.newrun_product_draft as Record<string, unknown> | null | undefined
  );
  const option = mergeProductDraftForOrder(
    first?.newrun_default_option_draft,
    order.newrun_option_draft as Record<string, unknown> | null | undefined
  );

  return {
    error: null as string | null,
    order,
    items: rowItems,
    drafts: { florist, product, option },
  };
}

async function persistSubmitResult(
  supabase: SupabaseClient,
  orderId: string,
  patch: {
    newrun_submit_status: string;
    newrun_rwr_result?: string | null;
    newrun_rwr_orderkey?: string | null;
    newrun_last_submit_error?: string | null;
  }
) {
  await supabase
    .from("orders")
    .update({
      ...patch,
      newrun_last_submit_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
}

/** T8.2.6: intranet_post / Mock 발주 시도마다 이력 (po-return 콜백과 별개) */
async function appendNewrunIntranetSubmitHistory(
  supabase: SupabaseClient,
  orderId: string,
  orderStatusForRow: string,
  source: NewrunSubmitSource,
  forceRetry: boolean | undefined,
  patch: {
    newrun_submit_status: string;
    newrun_rwr_result?: string | null;
    newrun_rwr_orderkey?: string | null;
    newrun_last_submit_error?: string | null;
  }
) {
  const memoParts = [
    "뉴런 intranet_post",
    `source=${source}`,
    forceRetry ? "forceRetry=1" : null,
    `submit=${patch.newrun_submit_status}`,
    patch.newrun_rwr_result != null && String(patch.newrun_rwr_result).trim() !== ""
      ? `rwr_result=${patch.newrun_rwr_result}`
      : null,
    patch.newrun_rwr_orderkey != null && String(patch.newrun_rwr_orderkey).trim() !== ""
      ? `rwr_orderkey=${String(patch.newrun_rwr_orderkey)}`
      : null,
    patch.newrun_last_submit_error != null && String(patch.newrun_last_submit_error).trim() !== ""
      ? `err=${String(patch.newrun_last_submit_error).slice(0, 400)}`
      : null,
  ].filter(Boolean) as string[];

  const { error } = await supabase.from("order_status_history").insert({
    order_id: orderId,
    status: orderStatusForRow,
    memo: memoParts.join(" · "),
  });
  if (error) {
    logger.warn(`${LOG} history insert failed`, {
      action: "newrun_submit_history_failed",
      data: { orderId, message: error.message },
    });
  }
}

async function persistSubmitResultAndHistory(
  supabase: SupabaseClient,
  orderId: string,
  patch: {
    newrun_submit_status: string;
    newrun_rwr_result?: string | null;
    newrun_rwr_orderkey?: string | null;
    newrun_last_submit_error?: string | null;
  },
  meta: {
    orderStatus: string;
    source: NewrunSubmitSource;
    forceRetry?: boolean;
  }
) {
  await persistSubmitResult(supabase, orderId, patch);
  await appendNewrunIntranetSubmitHistory(
    supabase,
    orderId,
    meta.orderStatus,
    meta.source,
    meta.forceRetry,
    patch
  );
}

/**
 * 뉴런 intranet_post 발주 1회 시도 (자동·수동 공통).
 * - `NEWRUN_MOCK=true`: 외부 미호출, `NEWRUN_MOCK_RWR_RESULT`(기본 0) 시뮬레이션
 * - `NEWRUN_ENABLED=true` 이고 Mock 아님: 실제 POST (`application/x-www-form-urlencoded`, 값 EUC-KR)
 * - 둘 다 아니면 skipped
 */
export async function submitNewrunOrder(
  supabase: SupabaseClient,
  orderId: string,
  options: {
    source: NewrunSubmitSource;
    /** 이미 성공(0)인 건 재전송 허용 */
    forceRetry?: boolean;
  }
): Promise<SubmitNewrunOrderResult> {
  const ctx = await loadSubmitContext(supabase, orderId);
  if (ctx.error || !ctx.order) {
    hookSubmitFailure("", orderId, "ORDER_LOAD", ctx.error ?? "주문 없음");
    return { ok: false, skipped: false, duplicate: false, message: ctx.error ?? "주문 없음" };
  }

  const order = ctx.order as Record<string, unknown> & {
    id: string;
    payment_status: string;
    status?: string | null;
    newrun_submit_status?: string | null;
    newrun_rwr_result?: string | null;
  };

  const historyStatus = String(order.status ?? "received");
  const orderNoHook = String(order.order_no ?? "").trim();

  if (order.payment_status !== "paid") {
    const msg = "결제완료된 주문만 뉴런 발주할 수 있습니다.";
    const patch = {
      newrun_submit_status: "failed",
      newrun_rwr_result: null as string | null,
      newrun_rwr_orderkey: null as string | null,
      newrun_last_submit_error: msg,
    };
    await persistSubmitResultAndHistory(supabase, orderId, patch, {
      orderStatus: historyStatus,
      source: options.source,
      forceRetry: options.forceRetry,
    });
    hookSubmitFailure(orderNoHook, orderId, "NOT_PAID", msg);
    return { ok: false, skipped: false, duplicate: false, message: msg };
  }

  if (
    !options.forceRetry &&
    order.newrun_submit_status === "success" &&
    order.newrun_rwr_result === "0"
  ) {
    return {
      ok: true,
      skipped: true,
      duplicate: false,
      rwr_result: "0",
      rwr_orderkey: (order as { newrun_rwr_orderkey?: string }).newrun_rwr_orderkey ?? undefined,
      message: "이미 발주가 완료된 주문입니다.",
    };
  }

  const creds = getNewrunCredentialsFromEnv();
  if (!creds) {
    const msg =
      "뉴런 발주 환경변수가 설정되지 않았습니다. (NEWRUN_ROSEWEB_ID, NEWRUN_ROSEWEB_PW, NEWRUN_RW_RETURNURL 필수 · rw_assoc는 NEWRUN_ASSOC_CODE 또는 NEWRUN_ASSOC_INTRANET_ID)";
    logger.warn(`${LOG} creds missing`, { action: "newrun_submit_no_env", data: { orderId } });
    await persistSubmitResultAndHistory(
      supabase,
      orderId,
      {
        newrun_submit_status: "failed",
        newrun_rwr_result: null,
        newrun_rwr_orderkey: null,
        newrun_last_submit_error: msg,
      },
      {
        orderStatus: historyStatus,
        source: options.source,
        forceRetry: options.forceRetry,
      }
    );
    hookSubmitFailure(orderNoHook, orderId, "NO_CREDENTIALS", msg);
    return { ok: false, skipped: false, duplicate: false, message: msg };
  }

  const itemSlices = (ctx.items ?? []).map((i: { quantity: number; product_name: string }) => ({
    quantity: i.quantity,
    product_name: i.product_name,
  }));

  let mapResult: ReturnType<typeof mapOrderToNewrunPayload>;
  try {
    mapResult = mapOrderToNewrunPayload(
      {
        id: String(order.id),
        order_no: String(order.order_no),
        payment_status: String(order.payment_status),
        total_amount: order.total_amount as number | string,
        shipping_name: String(order.shipping_name),
        shipping_phone: String(order.shipping_phone),
        shipping_postcode: (order.shipping_postcode as string | null) ?? null,
        shipping_address: String(order.shipping_address),
        shipping_detail: (order.shipping_detail as string | null) ?? null,
        created_at: order.created_at as string | undefined,
        desired_delivery_date: (order as { desired_delivery_date?: string | null }).desired_delivery_date ?? null,
        orderer_name: (order as { orderer_name?: string | null }).orderer_name ?? null,
        ribbon_sender: (order as { ribbon_sender?: string | null }).ribbon_sender ?? null,
        ribbon_message: (order as { ribbon_message?: string | null }).ribbon_message ?? null,
        venue_detail: (order as { venue_detail?: string | null }).venue_detail ?? null,
      },
      itemSlices,
      ctx.drafts!,
      creds,
      {
        strict: true,
        headquartersBonbalju: true,
        rw_method: "1",
      }
    );
  } catch (e) {
    const msg =
      e instanceof NewrunPayloadValidationError
        ? e.message
        : e instanceof Error
          ? e.message
          : "발주 필드 매핑 실패";
    logger.warn(`${LOG} map failed`, {
      action: "newrun_submit_map_error",
      data: { orderId, message: msg },
    });
    await persistSubmitResultAndHistory(
      supabase,
      orderId,
      {
        newrun_submit_status: "failed",
        newrun_last_submit_error: msg,
      },
      {
        orderStatus: historyStatus,
        source: options.source,
        forceRetry: options.forceRetry,
      }
    );
    hookSubmitFailure(orderNoHook, orderId, "VALIDATION", msg);
    return { ok: false, skipped: false, duplicate: false, message: msg };
  }

  mapResult.fields.rw_returnurl = appendNewrunPoReturnTokenToReturnUrl(
    mapResult.fields.rw_returnurl,
    mapResult.fields.rw_sno.trim()
  );

  const mock = isTruthyEnv(process.env.NEWRUN_MOCK);
  const enabled = isTruthyEnv(process.env.NEWRUN_ENABLED);

  if (!mock && !enabled) {
    const msg = "NEWRUN_ENABLED 또는 NEWRUN_MOCK이 켜져 있지 않아 발주를 건너뜁니다.";
    logger.info(`${LOG} skipped disabled`, { action: "newrun_submit_skipped", data: { orderId } });
    await persistSubmitResultAndHistory(
      supabase,
      orderId,
      {
        newrun_submit_status: "skipped",
        newrun_rwr_result: null,
        newrun_rwr_orderkey: null,
        newrun_last_submit_error: msg,
      },
      {
        orderStatus: historyStatus,
        source: options.source,
        forceRetry: options.forceRetry,
      }
    );
    return { ok: true, skipped: true, duplicate: false, message: msg, warnings: mapResult.warnings };
  }

  if (mock) {
    const rwr = (process.env.NEWRUN_MOCK_RWR_RESULT ?? "0").trim();
    const key =
      rwr === "0"
        ? `MOCK-${String(order.order_no)}`
        : undefined;
    const duplicate = rwr === "20";
    const ok = rwr === "0" || duplicate;
    await persistSubmitResultAndHistory(
      supabase,
      orderId,
      {
        newrun_submit_status: ok ? (duplicate ? "duplicate" : "success") : "failed",
        newrun_rwr_result: rwr,
        newrun_rwr_orderkey: key ?? null,
        newrun_last_submit_error: ok ? null : `Mock 실패 코드 ${rwr}`,
      },
      {
        orderStatus: historyStatus,
        source: options.source,
        forceRetry: options.forceRetry,
      }
    );
    if (!ok) {
      hookSubmitFailure(
        orderNoHook,
        orderId,
        rwr,
        `Mock 실패 rwr_result=${rwr}`
      );
    }
    return {
      ok,
      skipped: false,
      duplicate,
      rwr_result: rwr,
      rwr_orderkey: key,
      message: duplicate
        ? "뉴런(Mock): 동일 주문번호로 이미 접수된 것으로 시뮬레이션되었습니다."
        : ok
          ? "뉴런(Mock): 발주가 성공한 것으로 시뮬레이션되었습니다."
          : `뉴런(Mock): 발주 실패 시뮬레이션 (rwr_result=${rwr})`,
      warnings: mapResult.warnings,
    };
  }

  const url = intranetPostUrl();
  const body = encodeNewrunIntranetPostBody(mapResult.fields);

  let res: Response;
  try {
    logger.info(`${LOG} POST`, {
      action: "newrun_submit_http",
      data: {
        orderId,
        url,
        rw_menucode: mapResult.fields.rw_menucode,
        rw_arrive_place2: mapResult.fields.rw_arrive_place2?.slice(0, 80),
        rw_sendpeople: mapResult.fields.rw_sendpeople?.slice(0, 40),
      },
    });
    res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=EUC-KR",
      },
      body,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "intranet_post 네트워크 오류";
    logger.error(`${LOG} fetch error`, { action: "newrun_submit_fetch_error", data: { orderId, msg } });
    await persistSubmitResultAndHistory(
      supabase,
      orderId,
      {
        newrun_submit_status: "failed",
        newrun_last_submit_error: msg,
      },
      {
        orderStatus: historyStatus,
        source: options.source,
        forceRetry: options.forceRetry,
      }
    );
    hookSubmitFailure(orderNoHook, orderId, "NETWORK", msg);
    return { ok: false, skipped: false, duplicate: false, message: msg, warnings: mapResult.warnings };
  }

  const bodyText = await readIntranetPostResponseBodyText(res);
  const location =
    res.status >= 300 && res.status < 400 ? res.headers.get("Location") : null;
  const parsed = parseIntranetPostResponse({
    status: res.status,
    bodyText,
    locationHeader: location,
  });

  if (!parsed.rwr_result) {
    const msg = `intranet_post 응답에서 rwr_result를 찾지 못했습니다. (HTTP ${res.status})`;
    logger.warn(`${LOG} parse miss`, {
      action: "newrun_submit_parse_miss",
      data: { orderId, status: res.status, snippet: bodyText.slice(0, 200) },
    });
    await persistSubmitResultAndHistory(
      supabase,
      orderId,
      {
        newrun_submit_status: "failed",
        newrun_last_submit_error: msg,
      },
      {
        orderStatus: historyStatus,
        source: options.source,
        forceRetry: options.forceRetry,
      }
    );
    hookSubmitFailure(orderNoHook, orderId, "PARSE_MISS", msg);
    return {
      ok: false,
      skipped: false,
      duplicate: false,
      message: msg,
      warnings: mapResult.warnings,
    };
  }

  const rwr = parsed.rwr_result;
  const duplicate = rwr === "20";
  const ok = rwr === "0" || duplicate;

  await persistSubmitResultAndHistory(
    supabase,
    orderId,
    {
      newrun_submit_status: ok ? (duplicate ? "duplicate" : "success") : "failed",
      newrun_rwr_result: rwr,
      newrun_rwr_orderkey: parsed.rwr_orderkey.trim() || null,
      newrun_last_submit_error: ok ? null : `rwr_result=${rwr}`,
    },
    {
      orderStatus: historyStatus,
      source: options.source,
      forceRetry: options.forceRetry,
    }
  );

  if (!ok) {
    hookSubmitFailure(
      orderNoHook,
      orderId,
      rwr,
      `intranet_post rwr_result=${rwr}`
    );
  }

  return {
    ok,
    skipped: false,
    duplicate,
    rwr_result: rwr,
    rwr_orderkey: parsed.rwr_orderkey,
    message: duplicate
      ? "뉴런: 동일 쇼핑몰 주문번호로 이미 접수된 주문입니다. (결과코드 20)"
      : ok
        ? "뉴런 발주가 접수되었습니다."
        : `뉴런 발주 실패 (rwr_result=${rwr}). 어드민에서 확인 후 수동 재시도할 수 있습니다.`,
    warnings: mapResult.warnings,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { isValidNewrunPoReturnToken } from "@/lib/newrun/po-return-signing";
import {
  newrunPoReturnDetail,
  newrunPoReturnHeadline,
} from "@/lib/newrun/rwr-result-user-message";

const LOG = "[Newrun:PoReturn]";

function firstParam(
  raw: Record<string, string | string[] | undefined>,
  keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    if (Array.isArray(v)) {
      const s = v[0]?.trim();
      if (s) return s;
    } else {
      const s = v.trim();
      if (s) return s;
    }
  }
  return undefined;
}

export type PoReturnApplyResult =
  | {
      kind: "applied";
      orderId: string;
      orderNo: string;
      rwr_result: string;
      rwr_orderkey?: string;
      headline: string;
      detail: string;
    }
  | {
      kind: "skipped";
      reason: "no_rwr_result" | "no_order_key" | "order_not_found" | "bad_token" | "db_error";
      message: string;
      /** 디버그용(민감 정보 제외) */
      rawPreview?: string;
    };

function persistFromPoReturn(
  supabase: SupabaseClient,
  orderId: string,
  patch: {
    newrun_submit_status: string;
    newrun_rwr_result: string;
    newrun_rwr_orderkey: string | null;
    newrun_last_submit_error: string | null;
  }
) {
  return supabase
    .from("orders")
    .update({
      ...patch,
      newrun_last_submit_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
}

/**
 * 뉴런 브라우저 리턴 URL 쿼리 → 주문 매칭·DB 반영·이력 1건.
 * - 주문 키: `rwr_sno` | `rw_sno`(문서·현장 별칭)
 * - `NEWRUN_PO_RETURN_SECRET` 설정 시 쿼리 `nrpt`가 주문번호 HMAC과 일치해야 함
 */
export async function applyNewrunPoReturnFromSearchParams(
  supabase: SupabaseClient,
  raw: Record<string, string | string[] | undefined>
): Promise<PoReturnApplyResult> {
  const rwr_result = firstParam(raw, ["rwr_result", "RWR_RESULT"]);
  const rwr_orderkey = firstParam(raw, ["rwr_orderkey", "RWR_ORDERKEY"]);
  const orderNo = firstParam(raw, ["rwr_sno", "rwr_snr", "rw_sno", "RWR_SNO"]);
  const nrpt = firstParam(raw, ["nrpt"]);

  const rawPreview =
    Object.keys(raw).length > 0
      ? Object.entries(raw)
          .flatMap(([k, v]) => {
            if (Array.isArray(v)) return v.map((x) => `${k}=${x}`);
            return [`${k}=${v ?? ""}`];
          })
          .join("\n")
      : undefined;

  if (!rwr_result) {
    return {
      kind: "skipped",
      reason: "no_rwr_result",
      message: "뉴런에서 전달된 결과 코드(rwr_result)가 없어 반영하지 않았습니다.",
      rawPreview,
    };
  }

  if (!orderNo) {
    return {
      kind: "skipped",
      reason: "no_order_key",
      message: "주문번호(rwr_sno 등)가 없어 어떤 주문인지 확인할 수 없습니다.",
      rawPreview,
    };
  }

  const secret = process.env.NEWRUN_PO_RETURN_SECRET?.trim();
  if (!isValidNewrunPoReturnToken(orderNo, nrpt, secret)) {
    logger.warn(`${LOG} token mismatch`, {
      action: "newrun_po_return_bad_token",
      data: { orderNo: orderNo.slice(0, 12) },
    });
    return {
      kind: "skipped",
      reason: "bad_token",
      message: "주문 확인에 실패했습니다. 가맹점 관리자에게 문의해 주세요.",
    };
  }

  const { data: order, error: findErr } = await supabase
    .from("orders")
    .select("id, order_no")
    .eq("order_no", orderNo.trim())
    .maybeSingle();

  if (findErr || !order) {
    logger.warn(`${LOG} order not found`, {
      action: "newrun_po_return_order_missing",
      data: { orderNo: orderNo.slice(0, 12) },
    });
    return {
      kind: "skipped",
      reason: "order_not_found",
      message: "해당 주문을 찾을 수 없습니다. 주문번호를 확인하거나 가맹점에 문의해 주세요.",
    };
  }

  const rwr = rwr_result.trim();
  const duplicate = rwr === "20";
  const ok = rwr === "0" || duplicate;
  const submitStatus = ok ? (duplicate ? "duplicate" : "success") : "failed";
  const lastErr = ok ? null : `rwr_result=${rwr} (po-return)`;

  const { error: updErr } = await persistFromPoReturn(supabase, order.id, {
    newrun_submit_status: submitStatus,
    newrun_rwr_result: rwr,
    newrun_rwr_orderkey: rwr_orderkey?.trim() ?? null,
    newrun_last_submit_error: lastErr,
  });

  if (updErr) {
    logger.error(`${LOG} db update failed`, {
      action: "newrun_po_return_db_error",
      data: { orderId: order.id, message: updErr.message },
    });
    return {
      kind: "skipped",
      reason: "db_error",
      message: "결과를 저장하는 중 오류가 발생했습니다. 가맹점 관리자에게 문의해 주세요.",
    };
  }

  const memoParts = [
    "뉴런 발주 리턴(po-return)",
    `rwr_result=${rwr}`,
    rwr_orderkey ? `rwr_orderkey=${rwr_orderkey}` : null,
  ].filter(Boolean);
  const { error: histErr } = await supabase.from("order_status_history").insert({
    order_id: order.id,
    status: "received",
    memo: memoParts.join(" · "),
  });
  if (histErr) {
    logger.warn(`${LOG} history insert failed`, {
      action: "newrun_po_return_history_failed",
      data: { orderId: order.id, message: histErr.message },
    });
  }

  return {
    kind: "applied",
    orderId: order.id,
    orderNo: order.order_no,
    rwr_result: rwr,
    rwr_orderkey: rwr_orderkey?.trim(),
    headline: newrunPoReturnHeadline(rwr),
    detail: newrunPoReturnDetail(rwr),
  };
}

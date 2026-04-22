import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const LOG = "[Newrun:DeliveryStatus]";

/** DB order_status enum 과 일치 */
export type OrderStatusDb =
  | "received"
  | "confirmed"
  | "shipping"
  | "delivered"
  | "confirmed_purchase"
  | "cancelled"
  | "returned";

export type NewrunDeliveryInfoPayload = {
  ordercode?: string | null;
  oid?: string | null;
  state?: string | null;
  dica?: string | null;
  insuname?: string | null;
  insurel?: string | null;
  insudate1?: string | null;
  insudate2?: string | null;
  lastCallbackAt?: string;
};

/**
 * 뉴런 2.6 state → 내부 orders.status
 * - 2: 협회 측 주문접수/제작 진행 → confirmed (접수 직후와 구분)
 * - 3: 배송중
 * - 4: 배송완료
 */
export function mapNewrunDeliveryStateToOrderStatus(state: string | undefined): OrderStatusDb | null {
  if (state == null) return null;
  const s = String(state).trim();
  if (s === "2") return "confirmed";
  if (s === "3") return "shipping";
  if (s === "4") return "delivered";
  return null;
}

function lowerKeyRecord(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v == null) continue;
    const key = k.toLowerCase().trim();
    if (!key) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (t !== "") out[key] = t;
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[key] = String(v);
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      out[key] = JSON.stringify(v);
    }
  }
  return out;
}

/** GET 쿼리 + POST 본문(JSON·폼) 병합 (동일 키는 본문 우선) */
export function mergeNewrunDeliveryParams(
  query: Record<string, string>,
  body: Record<string, unknown> | null
): Record<string, string> {
  const q = lowerKeyRecord(query as Record<string, unknown>);
  const b = body ? lowerKeyRecord(body) : {};
  return { ...q, ...b };
}

export type ProcessNewrunDeliveryCallbackResult = {
  ok: boolean;
  reason:
    | "processed"
    | "missing_oid"
    | "order_not_found"
    | "db_error"
    | "skipped_no_op";
  detail?: string;
};

/**
 * 배송 콜백 1건 처리. 호출측은 항상 HTTP 200을 반환할 것.
 */
export async function processNewrunDeliveryCallback(
  supabase: SupabaseClient,
  params: Record<string, string>
): Promise<ProcessNewrunDeliveryCallbackResult> {
  const oid = params.oid ?? params.order_id ?? params.orderid;
  if (!oid?.trim()) {
    logger.warn(`${LOG} missing oid`, { action: "newrun_delivery_missing_oid" });
    return { ok: false, reason: "missing_oid", detail: "oid 없음" };
  }

  const stateRaw = params.state ?? "";
  const ordercode = params.ordercode ?? null;
  const dica = params.dica ?? null;
  const insuname = params.insuname ?? null;
  const insurel = params.insurel ?? null;
  const insudate1 = params.insudate1 ?? null;
  const insudate2 = params.insudate2 ?? null;

  const { data: order, error: findErr } = await supabase
    .from("orders")
    .select("id, status, newrun_delivery_info")
    .eq("order_no", oid.trim())
    .maybeSingle();

  if (findErr) {
    logger.error(`${LOG} find order`, {
      action: "newrun_delivery_find_error",
      data: { message: findErr.message },
    });
    return { ok: false, reason: "db_error", detail: findErr.message };
  }

  if (!order) {
    logger.warn(`${LOG} order not found`, {
      action: "newrun_delivery_order_missing",
      data: { oid: oid.trim().slice(0, 24) },
    });
    return { ok: false, reason: "order_not_found", detail: oid.trim() };
  }

  const prevRaw = order.newrun_delivery_info;
  const prevInfo =
    prevRaw != null && typeof prevRaw === "object" && !Array.isArray(prevRaw)
      ? (prevRaw as Record<string, unknown>)
      : {};
  const nowIso = new Date().toISOString();
  const pick = (k: string, incoming: string | null): string | null | undefined => {
    if (incoming != null && String(incoming).trim() !== "") return incoming.trim();
    const p = prevInfo[k];
    return typeof p === "string" && p.trim() !== "" ? p.trim() : null;
  };
  const infoPatch: NewrunDeliveryInfoPayload = {
    ...prevInfo,
    oid: oid.trim(),
    state: stateRaw.trim() || (typeof prevInfo.state === "string" ? prevInfo.state : null) || null,
    ordercode: pick("ordercode", ordercode),
    dica: pick("dica", dica),
    insuname: pick("insuname", insuname),
    insurel: pick("insurel", insurel),
    insudate1: pick("insudate1", insudate1),
    insudate2: pick("insudate2", insudate2),
    lastCallbackAt: nowIso,
  };

  const mappedStatus = mapNewrunDeliveryStateToOrderStatus(stateRaw);
  const prevStatus = order.status as string;
  const statusChanged = Boolean(mappedStatus && mappedStatus !== prevStatus);

  const updateRow: Record<string, unknown> = {
    newrun_delivery_info: infoPatch,
    updated_at: nowIso,
  };
  if (mappedStatus) {
    updateRow.status = mappedStatus;
  }

  const { error: updErr } = await supabase.from("orders").update(updateRow).eq("id", order.id);

  if (updErr) {
    logger.error(`${LOG} update order`, {
      action: "newrun_delivery_update_error",
      data: { orderId: order.id, message: updErr.message },
    });
    return { ok: false, reason: "db_error", detail: updErr.message };
  }

  /** T8.2.6: 콜백마다 이력 (상태 변경 없이 JSONB만 갱신된 경우 포함) */
  const afterStatus = (mappedStatus ?? prevStatus) as OrderStatusDb;
  const stateDisplay = stateRaw.trim() || "-";
  const memo =
    statusChanged && mappedStatus
      ? `뉴런 배송상태 업데이트 (상태코드: ${stateDisplay})`
      : `뉴런 배송 콜백 (상태코드: ${stateDisplay} · 주문 상태 변경 없음 · newrun_delivery_info 반영)`;

  const { error: histErr } = await supabase.from("order_status_history").insert({
    order_id: order.id,
    status: afterStatus,
    memo,
  });
  if (histErr) {
    logger.warn(`${LOG} history insert`, {
      action: "newrun_delivery_history_failed",
      data: { orderId: order.id, message: histErr.message },
    });
  }

  logger.info(`${LOG} ok`, {
    action: "newrun_delivery_processed",
    data: {
      orderId: order.id,
      state: stateRaw,
      statusChanged,
      newStatus: mappedStatus ?? prevStatus,
    },
  });

  return { ok: true, reason: "processed" };
}

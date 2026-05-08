import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const LOG = "[OrderPartnerNotify]";

export type OrderPartnerNotifyEventKind = "order_paid" | "order_cancelled";

/**
 * 파트너 주문 알림 이벤트 1건 기록.
 * (order_id, kind) 유니크 — 중복 시 삽입 생략.
 * 주문 본처리 실패를 막지 않도록 throw 하지 않음; 로그만 남김.
 */
export async function recordOrderPartnerNotifyEventSafe(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    partnerId: string;
    kind: OrderPartnerNotifyEventKind;
    source: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  const { orderId, partnerId, kind, source, payload } = params;
  if (!orderId?.trim() || !partnerId?.trim()) {
    logger.warn(`${LOG} partnerId/orderId 누락 — 스킵`, {
      action: "order_partner_notify_skip_missing_ids",
      data: { orderId, partnerId, kind, source },
    });
    return;
  }

  const { error } = await supabase.from("order_partner_notify_events").insert({
    order_id: orderId,
    partner_id: partnerId,
    kind,
    source: source.slice(0, 80),
    payload: payload ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return;
    }
    logger.warn(`${LOG} INSERT 실패`, {
      action: "order_partner_notify_insert_failed",
      data: { orderId, partnerId, kind, source, code: error.code, message: error.message },
    });
  }
}

/** 파트너·현재 로그인 사용자 기준 미확인 알림 건수 */
export async function countUnreadPartnerOrderNotifications(
  supabase: SupabaseClient,
  partnerId: string,
  userId: string
): Promise<number> {
  if (!partnerId?.trim() || !userId?.trim()) return 0;
  const { data, error } = await supabase.rpc("count_unread_partner_order_notifications", {
    p_partner_id: partnerId,
    p_user_id: userId,
  });
  if (error) {
    logger.warn(`${LOG} count rpc 실패`, {
      action: "order_partner_notify_count_failed",
      data: { partnerId, message: error.message, code: error.code },
    });
    return 0;
  }
  const n = typeof data === "number" ? data : Number(data ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

/**
 * 해당 주문에 속한 알림 이벤트를 현재 사용자 기준 모두 ack.
 */
export async function ackAllPartnerNotifyEventsForOrder(
  supabase: SupabaseClient,
  params: { partnerId: string; userId: string; orderId: string }
): Promise<void> {
  const { partnerId, userId, orderId } = params;
  if (!partnerId?.trim() || !userId?.trim() || !orderId?.trim()) return;

  const { data: events, error: evErr } = await supabase
    .from("order_partner_notify_events")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("order_id", orderId);

  if (evErr) {
    logger.warn(`${LOG} ack: 이벤트 조회 실패`, {
      action: "order_partner_notify_ack_list_failed",
      data: { orderId, message: evErr.message },
    });
    return;
  }
  if (!events?.length) return;

  const rows = events.map((e) => ({ user_id: userId, event_id: e.id }));
  const { error: insErr } = await supabase.from("order_partner_notify_acks").upsert(rows, {
    onConflict: "user_id,event_id",
    ignoreDuplicates: true,
  });
  if (insErr) {
    logger.warn(`${LOG} ack: INSERT 실패`, {
      action: "order_partner_notify_ack_insert_failed",
      data: { orderId, message: insErr.message, code: insErr.code },
    });
  }
}

/** 목록용: 페이지 내 주문 id들에 대해 현재 사용자 미확인 이벤트 존재 여부 */
export async function getUnreadNotifyOrderIdsForPartnerUser(
  supabase: SupabaseClient,
  partnerId: string,
  userId: string,
  orderIds: string[]
): Promise<Set<string>> {
  const unsettled = new Set<string>();
  if (!orderIds.length || !partnerId?.trim() || !userId?.trim()) return unsettled;

  const { data: events, error: evErr } = await supabase
    .from("order_partner_notify_events")
    .select("id, order_id")
    .eq("partner_id", partnerId)
    .in("order_id", orderIds);

  if (evErr || !events?.length) return unsettled;

  const eventIds = events.map((e) => e.id);
  const { data: acks } = await supabase
    .from("order_partner_notify_acks")
    .select("event_id")
    .eq("user_id", userId)
    .in("event_id", eventIds);

  const acked = new Set((acks ?? []).map((a) => a.event_id));
  for (const e of events) {
    if (!acked.has(e.id)) unsettled.add(e.order_id);
  }
  return unsettled;
}

/**
 * 체크아웃/비회원 주문 본문 → orders 테이블 화훼·배송 컬럼 정규화
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TIME_SLOT = 80;
const MAX_DELIVERY_METHOD = 50;
const MAX_MEMO = 4000;
const MAX_RIBBON_SENDER = 100;

export type FloristOrderDbFields = {
  desired_delivery_date: string | null;
  delivery_time_slot: string | null;
  delivery_method: string | null;
  delivery_request_memo: string | null;
  ribbon_sender: string | null;
  ribbon_message: string | null;
  /** ribbon | card | both — 리본 경조사(rw_kyungjo) / 카드 문구(rw_card) / 동시 */
  ribbon_message_kind: string;
  /** both 일 때 카드 쪽 문구(rw_card에 추가, 리본 문구는 ribbon_message) */
  ribbon_card_message: string | null;
  venue_detail: string | null;
};

function normalizeRibbonMessageKind(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "card" || s === "card_only") return "card";
  if (s === "both" || s === "ribbon_and_card") return "both";
  return "ribbon";
}

function clampText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.length <= max ? t : t.slice(0, max);
}

/** POST /api/orders JSON 본문에서 화훼·배송 필드만 추출 */
export function floristFieldsFromOrderBody(body: Record<string, unknown>): FloristOrderDbFields {
  let desired_delivery_date: string | null = null;
  const deliveryDate = body.deliveryDate;
  if (typeof deliveryDate === "string") {
    const s = deliveryDate.trim();
    if (DATE_RE.test(s)) desired_delivery_date = s;
  }

  const delivery_time_slot = clampText(body.deliveryTimeSlot, MAX_TIME_SLOT);
  const delivery_method = clampText(body.deliveryMethod, MAX_DELIVERY_METHOD);

  const memoRaw = body.deliveryRequestMemo ?? body.request_memo;
  const delivery_request_memo = clampText(memoRaw, MAX_MEMO);

  const ribbonRawSender = body.ribbonSender ?? body.ribbon_sender;
  const ribbon_sender = clampText(ribbonRawSender, MAX_RIBBON_SENDER);

  const ribbonRawMessage = body.ribbonMessage ?? body.ribbon_message;
  const ribbon_message = clampText(ribbonRawMessage, MAX_MEMO);

  const ribbon_message_kind = normalizeRibbonMessageKind(
    body.ribbonMessageKind ?? body.ribbon_message_kind
  );

  const cardRaw = body.ribbonCardMessage ?? body.ribbon_card_message;
  const ribbon_card_message = clampText(cardRaw, MAX_MEMO);

  const detailPlaceRaw = body.detailPlace ?? body.venueDetail ?? body.venue_detail;
  const venue_detail = clampText(detailPlaceRaw, MAX_MEMO);

  return {
    desired_delivery_date,
    delivery_time_slot,
    delivery_method,
    delivery_request_memo,
    ribbon_sender,
    ribbon_message,
    ribbon_message_kind,
    ribbon_card_message,
    venue_detail,
  };
}

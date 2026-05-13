/**
 * 주문 취소(전액) 가능 여부 — ViewPay 환불 + DB 반영 전 검증.
 * 우리부고 “접수”는 뉴런 2.6 콜백 state=2 이후로 가정(선구축).
 */

import type { NewrunDeliveryInfoPayload } from "@/lib/newrun/delivery-status-callback";

export type OrderRowForCancelEligibility = {
  payment_status: string | null;
  status: string | null;
  newrun_delivery_info?: unknown;
};

/** 협회 주문 접수(수동 발주 처리 완료) 이후 콜백 state — 뉴런 가이드 2:주문접수 */
const POST_ACCEPTANCE_STATES = new Set(["2", "3", "4"]);

function parseNewrunState(info: unknown): string | null {
  if (info == null || typeof info !== "object" || Array.isArray(info)) return null;
  const o = info as NewrunDeliveryInfoPayload;
  const s = o.state;
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

/** 고객: 결제완료 + 협회 접수(state≥2) 전만 취소 가능 */
export function canCustomerRequestCancel(order: OrderRowForCancelEligibility): {
  ok: true;
} | { ok: false; code: string; message: string } {
  const pay = String(order.payment_status ?? "").trim();
  if (pay !== "paid") {
    return { ok: false, code: "not_paid", message: "결제 완료된 주문만 취소할 수 있습니다." };
  }
  const st = String(order.status ?? "").trim();
  if (st === "cancelled") {
    return { ok: false, code: "already_cancelled", message: "이미 취소된 주문입니다." };
  }
  const nr = parseNewrunState(order.newrun_delivery_info);
  if (nr && POST_ACCEPTANCE_STATES.has(nr)) {
    return {
      ok: false,
      code: "association_accepted",
      message:
        "꽃돼지 협회에 주문이 접수된 뒤에는 고객 직접 취소가 어렵습니다. 고객센터로 문의해 주세요.",
    };
  }
  return { ok: true };
}

/**
 * 파트너 어드민: 선구축 — 배송완료(delivered 또는 뉴런 state 4) 전까지 전액 취소 허용.
 * (우리부고 답변 후 접수 이후·배송 중 정책 조정 가능)
 */
export function canPartnerAdminCancelOrder(order: OrderRowForCancelEligibility): {
  ok: true;
} | { ok: false; code: string; message: string } {
  const pay = String(order.payment_status ?? "").trim();
  if (pay !== "paid") {
    return { ok: false, code: "not_paid", message: "결제 완료된 주문만 결제 취소할 수 있습니다." };
  }
  const st = String(order.status ?? "").trim();
  if (st === "cancelled") {
    return { ok: false, code: "already_cancelled", message: "이미 취소된 주문입니다." };
  }
  if (st === "delivered") {
    return { ok: false, code: "delivered", message: "배송 완료된 주문은 시스템에서 결제 취소할 수 없습니다." };
  }
  const nr = parseNewrunState(order.newrun_delivery_info);
  if (nr === "4") {
    return { ok: false, code: "newrun_delivered", message: "협회 시스템상 배송 완료로 수신된 주문은 취소할 수 없습니다." };
  }
  return { ok: true };
}

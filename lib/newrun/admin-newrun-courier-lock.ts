/**
 * 파트너 어드민: 뉴런·협회 배송 연동 시 택배 송장 편집 잠금·표시 (Phase 8.2 / 8.3)
 */

export type NewrunCourierLockOrder = {
  newrun_submit_status?: string | null;
  newrun_rwr_orderkey?: string | null;
  newrun_delivery_info?: Record<string, unknown> | null;
};

export function hasNewrunDeliveryCallbackInfo(info: unknown): boolean {
  if (info == null || typeof info !== "object" || Array.isArray(info)) return false;
  const o = info as Record<string, unknown>;
  return Boolean(o.state || o.ordercode || o.dica || o.insuname || o.lastCallbackAt);
}

/** 화훼·협회 배송 흐름: 택배 송장 입력 비활성화 */
export function isNewrunCourierReadOnly(o: NewrunCourierLockOrder): boolean {
  const st = o.newrun_submit_status?.trim();
  if (st === "success" || st === "duplicate") return true;
  if (o.newrun_rwr_orderkey?.trim()) return true;
  if (hasNewrunDeliveryCallbackInfo(o.newrun_delivery_info)) return true;
  return false;
}

/** 결제 완료 + 뉴런 필드가 있는 주문 — 배송 목록 배지 */
export function shouldShowAdminNewrunShippingBadge(
  o: NewrunCourierLockOrder & { payment_status?: string | null }
): boolean {
  if (o.payment_status !== "paid") return false;
  if (o.newrun_submit_status?.trim()) return true;
  if (o.newrun_rwr_orderkey?.trim()) return true;
  if (hasNewrunDeliveryCallbackInfo(o.newrun_delivery_info)) return true;
  return false;
}

/** 주문 상세 카드용 긴 설명 */
export const ADMIN_NEWRUN_DELIVERY_STATE_HINT_LONG: Record<string, string> = {
  "2": "협회 단계 2 (주문확정·제작 진행)",
  "3": "협회 단계 3 (배송중)",
  "4": "협회 단계 4 (배송완료)",
};

const ASSOC_STATE_SHORT: Record<string, string> = {
  "2": "제작/접수",
  "3": "배송중",
  "4": "배송완료",
};

/** 배송 목록 등 한 줄 요약 (newrun_delivery_info.state) */
export function formatNewrunAssociationStateShort(info: unknown): string {
  if (info == null || typeof info !== "object" || Array.isArray(info)) return "—";
  const st = (info as Record<string, unknown>).state;
  if (st == null || String(st).trim() === "") return "—";
  const key = String(st).trim();
  return ASSOC_STATE_SHORT[key] ?? `코드 ${key}`;
}

/**
 * 쇼핑몰 고객용 주문 응답에서 뉴런·내부 연동 필드 제거 (Phase 8.5)
 */

const OMIT_ORDER_KEYS = [
  "newrun_florist_draft",
  "newrun_product_draft",
  "newrun_option_draft",
  "newrun_submit_status",
  "newrun_rwr_result",
  "newrun_rwr_orderkey",
  "newrun_last_submit_error",
  "newrun_last_submit_at",
  "newrun_delivery_info",
] as const;

export function sanitizeOrderRowForCustomer(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const k of OMIT_ORDER_KEYS) {
    delete out[k];
  }
  return out;
}

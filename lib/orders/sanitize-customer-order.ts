/**
 * 쇼핑몰 고객용 주문 응답에서 뉴런·내부 연동 필드 제거 (Phase 8.5)
 * `newrun_delivery_info.dica`만 검증 후 `delivery_photo_url`로만 노출
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

const DICA_MAX_LEN = 2048;

/** http(s) URL만 허용 — 전체 JSONB는 고객에게 내리지 않음 */
export function extractPublicDeliveryPhotoUrl(info: unknown): string | null {
  if (info == null || typeof info !== "object" || Array.isArray(info)) return null;
  const raw = (info as Record<string, unknown>).dica;
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.length < 12 || s.length > DICA_MAX_LEN) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return s;
  } catch {
    return null;
  }
}

export function sanitizeOrderRowForCustomer(row: Record<string, unknown>): Record<string, unknown> {
  const deliveryPhoto = extractPublicDeliveryPhotoUrl(row.newrun_delivery_info);
  const out = { ...row };
  for (const k of OMIT_ORDER_KEYS) {
    delete out[k];
  }
  if (deliveryPhoto) {
    out.delivery_photo_url = deliveryPhoto;
  }
  return out;
}

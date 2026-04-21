/**
 * 주문에 저장된 뉴런 draft와 거래처·상품 기본 draft 병합.
 * 얕은 병합: 동일 키는 **주문(또는 나중 인자)** 값이 우선.
 */

function valueToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/**
 * @param layers 뒤쪽 레이어가 앞쪽을 덮어씀 (일반적으로 [...defaults, orderDraft])
 */
export function mergeNewrunDraftLayers(
  ...layers: (Record<string, unknown> | null | undefined)[]
): Record<string, string> | null {
  const out: Record<string, string> = {};
  let any = false;
  for (const layer of layers) {
    if (!isPlainObject(layer)) continue;
    any = true;
    for (const [k, v] of Object.entries(layer)) {
      out[k] = valueToString(v);
    }
  }
  return any ? out : null;
}

/** 거래처 기본 → 주문 저장 순 (주문이 우선) */
export function mergeFloristDraftForOrder(
  clientDefault: Record<string, unknown> | null | undefined,
  orderDraft: Record<string, unknown> | null | undefined
): Record<string, string> | null {
  return mergeNewrunDraftLayers(clientDefault, orderDraft);
}

/** 상품 기본 → 주문 저장 순 */
export function mergeProductDraftForOrder(
  productDefault: Record<string, unknown> | null | undefined,
  orderDraft: Record<string, unknown> | null | undefined
): Record<string, string> | null {
  return mergeNewrunDraftLayers(productDefault, orderDraft);
}

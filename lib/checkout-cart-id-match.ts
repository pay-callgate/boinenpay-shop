/** cart_item id 집합 정규화 (멱등·불일치 경고용) */
export function normalizeCartItemIdSet(ids: string[]): string[] {
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))].sort();
}

export function cartItemIdsEqual(
  a: string[] | null | undefined,
  b: string[] | null | undefined
): boolean {
  const na = normalizeCartItemIdSet(a ?? []);
  const nb = normalizeCartItemIdSet(b ?? []);
  if (na.length !== nb.length) return false;
  return na.every((v, i) => v === nb[i]);
}

/** 장바구니 vs pending 주문 checkout_cart_item_ids 불일치 여부 */
export function hasCheckoutCartMismatch(
  cartItemIds: string[],
  orderCartItemIds: string[] | null | undefined
): boolean {
  if (!orderCartItemIds?.length) return false;
  return !cartItemIdsEqual(cartItemIds, orderCartItemIds);
}

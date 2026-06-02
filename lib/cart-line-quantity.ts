/** cart / checkout 공통 — 주문 가능 최대 수량 */
export function maxCartLineOrderQty(
  product: { status: string; stock_qty?: number | null },
  currentQty: number
): number {
  if (product.status === "sold_out") return currentQty;
  const s = product.stock_qty;
  if (s == null || Number(s) <= 0) return 99_999;
  return Math.max(1, Number(s));
}

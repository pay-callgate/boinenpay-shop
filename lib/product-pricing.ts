/**
 * 상품 단가 — sale_price: 비회원, member_price: 회원 (NULL이면 sale_price와 동일)
 */
export type ProductPriceRow = {
  base_price: number | null;
  sale_price: number | null;
  member_price?: number | null;
};

export function effectiveGuestUnitPrice(p: ProductPriceRow): number {
  const base = Number(p.base_price) || 0;
  const sale = p.sale_price != null ? Number(p.sale_price) : null;
  return sale != null && sale >= 0 ? sale : base;
}

export function effectiveMemberUnitPrice(p: ProductPriceRow): number {
  const guest = effectiveGuestUnitPrice(p);
  const mp = p.member_price;
  if (mp != null && Number(mp) >= 0) return Number(mp);
  return guest;
}

export function discountPercent(base: number, sell: number): number | null {
  if (base <= 0 || sell >= base) return null;
  return Math.round((1 - sell / base) * 100);
}

/**
 * 쇼핑몰(프런트) 상품 노출 규칙.
 * 관리자에서 임시저장(draft)인 상품은 목록·홈에 나오지 않으며, 상세는 판매중·품절만 허용한다.
 *
 * 목록·홈: 판매중(active)이어도 재고 0이면 노출하지 않는다(어드민「재고부족」과 정합).
 * 상세 URL·품절 표기 등은 별도 API 정책(SHOP_PRODUCT_DETAIL_ALLOWED_STATUSES).
 */

/** 목록·홈·카테고리(상품 있는 메뉴) 조회 시 — 판매중만 */
export const SHOP_LIST_PRODUCT_STATUS = "active" as const;

/** 목록·홈에서 active 상품이 실제로 구매 가능하려면 최소 이 수량 이상이어야 함 */
export const SHOP_LIST_MIN_STOCK_QTY = 1 as const;

/** 상품 상세 API — 직접 URL 접근 시 임시저장은 404, 품절은 조회 가능 */
export const SHOP_PRODUCT_DETAIL_ALLOWED_STATUSES = ["active", "sold_out"] as const;

/** 목록에서는 제외되지만 URL로 들어온 경우: 품절 UI·구매 버튼 비활성화용 */
export function isShopProductEffectivelySoldOut(product: {
  status: string;
  stock_qty?: number | null;
}): boolean {
  if (product.status === "sold_out") return true;
  const qty = product.stock_qty ?? 0;
  return qty < SHOP_LIST_MIN_STOCK_QTY;
}

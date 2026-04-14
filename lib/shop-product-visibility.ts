/**
 * 쇼핑몰(프런트) 상품 노출 규칙.
 * 관리자에서 임시저장(draft)인 상품은 목록·홈에 나오지 않으며, 상세는 판매중·품절만 허용한다.
 */

/** 목록·홈·카테고리(상품 있는 메뉴) 조회 시 — 판매중만 */
export const SHOP_LIST_PRODUCT_STATUS = "active" as const;

/** 상품 상세 API — 직접 URL 접근 시 임시저장은 404, 품절은 조회 가능 */
export const SHOP_PRODUCT_DETAIL_ALLOWED_STATUSES = ["active", "sold_out"] as const;

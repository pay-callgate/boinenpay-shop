/**
 * 관리자 상품 등록/수정 — delivery_methods(JSONB NOT NULL) 공통 처리
 */

/** 신규 상품 모달 오픈 시 기본 선택: 당일배송 + 퀵서비스 */
export const DEFAULT_PRODUCT_DELIVERY_METHODS = ["same_day", "quick"] as const;

/**
 * DB 저장용: null/undefined 방지, 항상 string[] 반환 (빈 배열 허용)
 */
export function normalizeDeliveryMethodsForDb(input: unknown): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) {
    return input.filter((x): x is string => typeof x === "string");
  }
  if (typeof input === "object") {
    return Object.values(input as Record<string, unknown>).filter(
      (x): x is string => typeof x === "string"
    );
  }
  return [];
}

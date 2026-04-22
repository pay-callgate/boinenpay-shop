/**
 * 쇼핑몰 고객 화면 주문·결제 상태 한글 라벨 (Phase 8.5)
 * 알 수 없는 코드는 원문 노출 대신 완화된 문구 사용.
 */

export const SHOP_ORDER_STATUS_LABELS: Record<string, string> = {
  received: "접수 완료",
  confirmed: "주문 확정",
  pending_payment: "입금 대기",
  paid: "결제 완료",
  preparing: "배송 준비 중",
  shipping: "배송 중",
  delivered: "배송 완료",
  confirmed_purchase: "구매 확정",
  cancelled: "취소됨",
  returned: "반품",
};

export const SHOP_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "결제 대기",
  paid: "결제 완료",
  failed: "결제 실패",
  refunded: "환불됨",
};

export function shopOrderStatusLabel(status: string | undefined | null): string {
  if (status == null || status === "") return "처리 중";
  return SHOP_ORDER_STATUS_LABELS[status] ?? "처리 중";
}

export function shopPaymentStatusLabel(status: string | undefined | null): string {
  if (status == null || status === "") return "—";
  return SHOP_PAYMENT_STATUS_LABELS[status] ?? "처리 중";
}

/** 배지·강조색 (hex) */
export function shopOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    received: "#64748B",
    confirmed: "#0EA5E9",
    pending_payment: "#F59E0B",
    paid: "#10B981",
    preparing: "#3B82F6",
    shipping: "#D6A8E0",
    delivered: "#059669",
    confirmed_purchase: "#047857",
    cancelled: "#EF4444",
    returned: "#B45309",
  };
  return colors[status] ?? "#6B7280";
}

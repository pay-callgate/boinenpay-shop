/** 어드민 주문 상세 공통 라벨·옵션 */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  received: "접수",
  confirmed: "주문확정",
  pending_payment: "입금대기",
  paid: "결제완료",
  preparing: "배송준비중",
  shipping: "배송중",
  delivered: "배송완료",
  cancelled: "취소됨",
};

export const ORDER_STATUS_OPTIONS = [
  { value: "received", label: "접수" },
  { value: "confirmed", label: "주문확정" },
  { value: "paid", label: "결제완료" },
  { value: "preparing", label: "배송준비중" },
  { value: "shipping", label: "배송중" },
  { value: "delivered", label: "배송완료" },
  { value: "cancelled", label: "취소됨" },
] as const;

/** 진행 중·주목 상태 → 오렌지 강조 (배지·강조용) */
export function isOrderStatusHighlightActive(status: string): boolean {
  return (
    status === "received" ||
    status === "pending_payment" ||
    status === "confirmed" ||
    status === "preparing" ||
    status === "shipping"
  );
}

export const cardBaseClass =
  "rounded-xl border border-gray-200 bg-white p-5 shadow-sm";

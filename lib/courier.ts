/**
 * 택배사 선택 옵션 (관리자 송장 입력·배송 조회용)
 */
export const COURIER_OPTIONS = [
  { value: "", label: "선택안함" },
  { value: "CJ대한통운", label: "CJ대한통운" },
  { value: "우체국택배", label: "우체국택배" },
  { value: "로젠택배", label: "로젠택배" },
  { value: "한진택배", label: "한진택배" },
  { value: "롯데택배", label: "롯데택배" },
] as const;

/**
 * 배송지/이력 등에 노출할 송장 문자열: "[택배사명] 송장번호"
 * 택배사 없으면 송장번호만, 둘 다 없으면 "-"
 */
export function formatTrackingDisplay(
  courierCompany: string | null | undefined,
  trackingNumber: string | null | undefined
): string {
  const num = trackingNumber?.trim() || "";
  const courier = courierCompany?.trim() || "";
  if (!num) return "-";
  return courier ? `[${courier}] ${num}` : num;
}

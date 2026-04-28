/**
 * 화훼 배달 주문서 공통 — 비회원·회원 체크아웃에서 공유
 */

export const TIME_SLOTS = [
  "09:00~11:00",
  "11:00~13:00",
  "13:00~15:00",
  "14:00~16:00",
  "15:00~17:00",
  "17:00~19:00",
] as const;

export const RIBBON_MESSAGE_PRESETS: { value: string; label: string }[] = [
  { value: "__custom__", label: "직접 입력" },
  { value: "삼가 고인의 명복을 빕니다", label: "삼가 고인의 명복을 빕니다" },
  { value: "근조", label: "근조" },
  { value: "축하합니다", label: "축하합니다" },
  { value: "정성을 담아 보냅니다", label: "정성을 담아 보냅니다" },
];

export function digitsOnlyPhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** shipping_detail 텍스트 — 뉴런/내부 이력용 블록 */
export function buildFloristShippingDetailText(parts: {
  venueDetail: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  ordererName: string;
  ordererPhone: string;
  ribbonSender: string;
  ribbonMessage: string;
}): string {
  const lines: string[] = [];
  const v = parts.venueDetail.trim();
  if (v) lines.push(v);
  lines.push("");
  lines.push(`[배달 희망] ${parts.deliveryDate} ${parts.deliveryTimeSlot}`);
  lines.push(`[주문자] ${parts.ordererName.trim()} / ${parts.ordererPhone.trim()}`);
  lines.push(`[보내는 분(리본)] ${parts.ribbonSender.trim()}`);
  lines.push(`[리본 문구] ${parts.ribbonMessage.trim()}`);
  return lines.join("\n");
}

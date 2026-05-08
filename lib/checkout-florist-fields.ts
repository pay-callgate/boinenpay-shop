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

export type RibbonMessageKind = "ribbon" | "card" | "both";

export const RIBBON_MESSAGE_KIND_OPTIONS: { value: RibbonMessageKind; label: string }[] = [
  { value: "ribbon", label: "리본만" },
  { value: "card", label: "카드만" },
  { value: "both", label: "카드+리본" },
];

export const RIBBON_MESSAGE_PRESETS: { value: string; label: string }[] = [
  { value: "__custom__", label: "직접 입력" },
  { value: "삼가 고인의 명복을 빕니다", label: "삼가 고인의 명복을 빕니다" },
  { value: "삼가 故人의 冥福을 빕니다", label: "삼가 故人의 冥福을 빕니다" },
  { value: "근조", label: "근조" },
  { value: "축결혼", label: "祝結婚 · 축결혼" },
  { value: "축화혼", label: "祝華婚 · 축화혼" },
  { value: "축발전", label: "祝發展 · 축발전" },
  { value: "축개업", label: "祝開業 · 축개업" },
  { value: "축영전", label: "祝榮轉 · 축영전" },
  { value: "축승진", label: "祝昇進 · 축승진" },
  { value: "축생일", label: "祝生日 · 축생일" },
  { value: "축고희", label: "祝古稀 · 축고희" },
  { value: "축하합니다", label: "축하합니다" },
  { value: "정성을 담아 보냅니다", label: "정성을 담아 보냅니다" },
];

/** 협회 화면과 유사한 퀵 버튼용 (값 = API·뉴런에 보낼 문구) */
export const RIBBON_QUICK_PHRASES: { label: string; value: string }[] = [
  { label: "祝結婚\n축결혼", value: "축결혼" },
  { label: "祝華婚\n축화혼", value: "축화혼" },
  { label: "謹弔\n근조", value: "근조" },
  { label: "祝發展\n축발전", value: "축발전" },
  { label: "祝開業\n축개업", value: "축개업" },
  { label: "祝榮轉\n축영전", value: "축영전" },
  { label: "祝昇進\n축승진", value: "축승진" },
  { label: "祝生日\n축생일", value: "축생일" },
  { label: "祝古稀\n축고희", value: "축고희" },
  { label: "삼가 故人의\n冥福을 빕니다", value: "삼가 故人의 冥福을 빕니다" },
  { label: "삼가 고인의\n명복을 빕니다", value: "삼가 고인의 명복을 빕니다" },
];

export function resolveRibbonPhrase(preset: string, custom: string): string {
  if (preset === "__custom__") return custom.trim();
  return preset.trim();
}

export function presetFromQuickPhrase(
  phrase: string,
  presets: readonly { value: string; label: string }[]
): { preset: string; custom: string } {
  const hit = presets.find((p) => p.value === phrase && p.value !== "__custom__");
  if (hit) return { preset: hit.value, custom: "" };
  return { preset: "__custom__", custom: phrase };
}

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
  /** 리본 문구 또는 카드만 선택 시 카드 문구(단일 필드) */
  ribbonMessage: string;
  ribbonMessageKind?: RibbonMessageKind;
  /** 카드+리본 일 때 카드 쪽 문구 */
  ribbonCardMessage?: string;
}): string {
  const lines: string[] = [];
  const v = parts.venueDetail.trim();
  if (v) lines.push(v);
  lines.push("");
  lines.push(`[배달 희망] ${parts.deliveryDate} ${parts.deliveryTimeSlot}`);
  lines.push(`[주문자] ${parts.ordererName.trim()} / ${parts.ordererPhone.trim()}`);
  lines.push(`[보내는 분(리본)] ${parts.ribbonSender.trim()}`);
  const kind = parts.ribbonMessageKind ?? "ribbon";
  const rm = parts.ribbonMessage.trim();
  const cm = (parts.ribbonCardMessage ?? "").trim();
  if (kind === "card") {
    lines.push(`[메시지] 카드 — ${rm}`);
  } else if (kind === "both") {
    lines.push(`[리본 문구] ${rm}`);
    if (cm) lines.push(`[카드 문구] ${cm}`);
  } else {
    lines.push(`[리본 문구] ${rm}`);
  }
  return lines.join("\n");
}

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

export function resolveRibbonPhrase(preset: string, custom: string): string {
  if (preset === "__custom__") return custom.trim();
  return preset.trim();
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
  /** 리본 경조사어 → 뉴런 rw_kyungjo */
  ribbonMessage: string;
  /** 선택 — 뉴런 rw_card */
  ribbonCardMessage?: string;
}): string {
  const lines: string[] = [];
  const v = parts.venueDetail.trim();
  if (v) lines.push(v);
  lines.push("");
  lines.push(`[배달 희망] ${parts.deliveryDate} ${parts.deliveryTimeSlot}`);
  lines.push(`[주문자] ${parts.ordererName.trim()} / ${parts.ordererPhone.trim()}`);
  lines.push(`[보내는 분(리본)] ${parts.ribbonSender.trim()}`);
  const rm = parts.ribbonMessage.trim();
  const cm = (parts.ribbonCardMessage ?? "").trim();
  lines.push(`[리본 문구] ${rm}`);
  if (cm) lines.push(`[카드 문구] ${cm}`);
  return lines.join("\n");
}

/**
 * shipping_detail에 붙은 `[배달 희망]` 등 내부 이력용 블록은 수령인 카드 등 UI에서는 숨김.
 * 본문은 `buildFloristShippingDetailText`와 동일한 줄 순서를 가정한다.
 */
export function stripFloristShippingDetailMeta(detail: string | null | undefined): string {
  if (detail == null || detail.trim() === "") return "";
  const lines = detail.replace(/\r\n/g, "\n").split("\n");
  const metaIdx = lines.findIndex((line) => {
    const t = line.trim();
    return (
      t.startsWith("[배달 희망]") ||
      t.startsWith("[주문자]") ||
      t.startsWith("[보내는 분") ||
      t.startsWith("[리본 문구]") ||
      t.startsWith("[카드 문구]")
    );
  });
  const head = metaIdx >= 0 ? lines.slice(0, metaIdx) : lines;
  const cleanedLines = head
    .map((line) => line.trim())
    .filter((line) => {
      if (line === "") return false;
      if (/^[\u2014\u2013–—\-\s]+$/u.test(line)) return false;
      return true;
    });
  return cleanedLines.join("\n").trim();
}

/**
 * `shipping_address`에 실수로 이어 붙은 화훼 메타(`[배달 희망]` 등) 제거
 */
export function stripFloristMetaSuffixFromAddressLine(addr: string): string {
  let s = addr.trim();
  const markers = [
    " — [",
    " —[",
    "— [",
    "—[",
    " [배달 희망]",
    " [주문자]",
    " [보내는 분",
    " [리본 문구]",
    " [카드 문구]",
  ];
  for (const m of markers) {
    const i = s.indexOf(m);
    if (i >= 0) s = s.slice(0, i).trim();
  }
  return s.replace(/\s+[—–]$/u, "").trim();
}

/**
 * 고객용 화면: 도로명·상세(장소)만 한 줄로. `shipping_detail`의 뉴런 메타 블록은 제외.
 */
export function formatFloristShippingAddressForCustomerUI(
  shippingAddress: string | null | undefined,
  shippingDetail: string | null | undefined
): string {
  const addr = stripFloristMetaSuffixFromAddressLine(String(shippingAddress ?? ""));
  const det = stripFloristShippingDetailMeta(shippingDetail);
  const detOneLine = det.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return [addr, detOneLine].filter(Boolean).join(" ").trim();
}

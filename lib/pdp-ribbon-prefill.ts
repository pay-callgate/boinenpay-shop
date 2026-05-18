/**
 * 상품 상세(PDP)에서 입력한 리본 문구를 주문서로 전달할 때 사용하는 sessionStorage 키.
 */

export const PDP_RIBBON_PREFILL_KEY = "calllink_pdp_ribbon_prefill";

export type PdpRibbonPrefill = {
  ribbonSender: string;
  ribbonMessage: string;
};

export function writePdpRibbonPrefill(data: PdpRibbonPrefill): void {
  if (typeof window === "undefined") return;
  try {
    const sender = (data.ribbonSender ?? "").trim();
    const message = (data.ribbonMessage ?? "").trim();
    if (!sender && !message) {
      sessionStorage.removeItem(PDP_RIBBON_PREFILL_KEY);
      return;
    }
    sessionStorage.setItem(PDP_RIBBON_PREFILL_KEY, JSON.stringify({ ribbonSender: sender, ribbonMessage: message }));
  } catch {
    /* storage full / private mode */
  }
}

/** 읽은 뒤 즉시 제거 (주문서 진입 1회 적용) */
export function readAndClearPdpRibbonPrefill(): PdpRibbonPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PDP_RIBBON_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PDP_RIBBON_PREFILL_KEY);
    const parsed = JSON.parse(raw) as PdpRibbonPrefill;
    return {
      ribbonSender: typeof parsed.ribbonSender === "string" ? parsed.ribbonSender : "",
      ribbonMessage: typeof parsed.ribbonMessage === "string" ? parsed.ribbonMessage : "",
    };
  } catch {
    return null;
  }
}

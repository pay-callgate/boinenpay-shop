"use client";

import { toast } from "@/components/shop/ToastContext";

const TRANSFER_HINT =
  "현재 신용카드 결제만 가능합니다. 무통장 입금은 추후 지원 예정입니다.";

type Props = {
  paymentMethod: string;
  onSelectCard: () => void;
  /** 하위 호환용 — 카드 선택 스타일은 회색 톤 고정 */
  primaryColor: string;
  primaryLight: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
};

const CARD_ACTIVE_BG = "#F4F4F4";
const CARD_ACTIVE_BORDER = "#D4D4D4";

/** 모바일 이커머스형 결제 수단 — 카드형 세그먼트(무통장은 준비 중) */
export function CheckoutPaymentMethodSegment({
  paymentMethod,
  onSelectCard,
  borderColor,
  textColor,
  mutedColor,
}: Props) {
  const cardActive = paymentMethod === "card";

  /** 결제 수단 두 버튼 동일 높이 (터치 영역 약 44px) */
  const segmentBtn =
    "flex h-11 min-h-[44px] flex-1 items-center justify-center rounded-xl border-2 px-2 text-sm transition-all";

  return (
    <div className="flex w-full gap-2">
      <button
        type="button"
        onClick={onSelectCard}
        className={`${segmentBtn} font-bold ${cardActive ? "shadow-sm" : "opacity-95"}`}
        style={{
          borderColor: cardActive ? CARD_ACTIVE_BORDER : borderColor,
          backgroundColor: cardActive ? CARD_ACTIVE_BG : "#fff",
          color: textColor,
          boxShadow: cardActive ? "0 1px 2px rgba(0,0,0,0.05)" : undefined,
        }}
      >
        신용카드
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          toast(TRANSFER_HINT, "default");
        }}
        className={`${segmentBtn} font-semibold`}
        style={{
          borderColor: borderColor,
          backgroundColor: "#F9FAFB",
          color: mutedColor,
          opacity: 0.82,
        }}
        aria-disabled
      >
        <span className="flex items-center justify-center gap-1.5">
          <span className="opacity-80">무통장입금</span>
          <span
            className="shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: "#E5E7EB",
              color: "#6B7280",
            }}
          >
            준비중
          </span>
        </span>
      </button>
    </div>
  );
}

"use client";

import { Minus, Plus } from "lucide-react";

/** PDP 수량 조절과 동일한 버튼 스타일 (상품 상세 · 주문서 공통) */
const QTY_GROUP_CLASS =
  "inline-flex overflow-hidden rounded-2xl border border-violet-200/70 bg-white shadow-[0_2px_8px_-2px_rgba(139,92,246,0.12)] ring-1 ring-violet-100/50";

const QTY_BTN_CLASS =
  "flex h-11 w-11 shrink-0 items-center justify-center text-violet-500 transition hover:bg-violet-50/90 active:bg-violet-100/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D6A8E0]/45 disabled:pointer-events-none disabled:opacity-35";

const QTY_VALUE_CLASS =
  "flex h-11 min-w-[3.25rem] items-center justify-center border-x border-violet-100 bg-gradient-to-b from-violet-50/80 to-white px-2 text-sm font-semibold tabular-nums text-violet-950";

type CheckoutLineQuantityControlProps = {
  quantity: number;
  maxQty: number;
  disabled?: boolean;
  onChange: (next: number) => void;
  className?: string;
};

export function CheckoutLineQuantityControl({
  quantity,
  maxQty,
  disabled = false,
  onChange,
  className = "",
}: CheckoutLineQuantityControlProps) {
  const atMin = quantity <= 1;
  const atMax = quantity >= maxQty;

  return (
    <div
      className={`${QTY_GROUP_CLASS}${className ? ` ${className}` : ""}`}
      role="group"
      aria-label="수량 조절"
    >
      <button
        type="button"
        disabled={disabled || atMin}
        onClick={() => onChange(Math.max(1, quantity - 1))}
        className={QTY_BTN_CLASS}
        aria-label="수량 감소"
      >
        <Minus className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <span className={QTY_VALUE_CLASS}>{quantity}</span>
      <button
        type="button"
        disabled={disabled || atMax}
        onClick={() => onChange(Math.min(maxQty, quantity + 1))}
        className={QTY_BTN_CLASS}
        aria-label="수량 증가"
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

"use client";

import { Minus, Plus } from "lucide-react";

const PRIMARY = "#D6A8E0";

type CheckoutLineQuantityControlProps = {
  quantity: number;
  maxQty: number;
  disabled?: boolean;
  onChange: (next: number) => void;
};

export function CheckoutLineQuantityControl({
  quantity,
  maxQty,
  disabled = false,
  onChange,
}: CheckoutLineQuantityControlProps) {
  const atMin = quantity <= 1;
  const atMax = quantity >= maxQty;

  return (
    <div
      className="mt-2 inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white"
      role="group"
      aria-label="수량 조절"
    >
      <button
        type="button"
        disabled={disabled || atMin}
        onClick={() => onChange(Math.max(1, quantity - 1))}
        className="flex h-9 w-9 items-center justify-center text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="수량 감소"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      <span className="flex h-9 min-w-[2.5rem] items-center justify-center border-x border-gray-200 px-2 text-sm font-semibold tabular-nums text-gray-900">
        {quantity}
      </span>
      <button
        type="button"
        disabled={disabled || atMax}
        onClick={() => onChange(Math.min(maxQty, quantity + 1))}
        className="flex h-9 w-9 items-center justify-center transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-35"
        style={{ color: PRIMARY }}
        aria-label="수량 증가"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

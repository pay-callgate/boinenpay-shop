"use client";

import React from "react";
import { ORDER_PROGRESS_STEP_LABELS } from "@/lib/shop/customer-order-fulfillment";

type Props = {
  /** 0..3 = 현재 단계, -1 = 미표시(미결제 등) */
  activeIndex: number;
};

/**
 * 주문 상세 상단 가로 진행 바 (결제 완료 → 상품 준비중 → 배송 출발 → 배송 완료)
 * 파스텔 핑크/퍼플 톤
 */
export function OrderProgressStepper({ activeIndex }: Props) {
  if (activeIndex < 0) return null;

  const steps = ORDER_PROGRESS_STEP_LABELS;
  const n = steps.length;

  return (
    <div className="w-full px-1">
      <div className="flex w-full max-w-full items-center">
        {steps.map((label, i) => {
          const done = i < activeIndex;
          const current = i === activeIndex;
          const segmentDone = i < n - 1 && activeIndex > i;

          const circleClass = current
            ? "border border-pink-200 bg-pink-100 font-bold text-pink-600"
            : done
              ? "border border-pink-500 bg-pink-500 text-white"
              : "border border-transparent bg-gray-100 text-gray-400";

          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] ${circleClass}`}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? "✓" : i + 1}
                </div>
              </div>
              {i < n - 1 ? (
                <div
                  className={`mx-1 mb-5 h-[2px] min-w-[8px] flex-1 rounded-full ${
                    segmentDone ? "bg-pink-300" : "bg-gray-200"
                  }`}
                  aria-hidden
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
      <div
        className="mt-2 grid w-full gap-1"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {steps.map((label, i) => {
          const done = i < activeIndex;
          const current = i === activeIndex;
          return (
            <div
              key={`${label}-caption`}
              className={`min-w-0 text-center text-[10px] font-semibold leading-snug sm:text-[11px] ${
                current ? "text-pink-600" : done ? "text-pink-500" : "text-gray-400"
              }`}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

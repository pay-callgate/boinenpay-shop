"use client";

import React from "react";
import { ORDER_PROGRESS_STEP_LABELS } from "@/lib/shop/customer-order-fulfillment";

type Props = {
  /** 0..3 = 현재 단계, -1 = 미표시(미결제 등) */
  activeIndex: number;
};

/**
 * 주문 상세 상단 가로 진행 바 (결제 완료 → 화환 제작중 → 배송 출발 → 배송 완료)
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
            ? "border-[#4338CA] bg-[#4338CA] text-white shadow-md ring-2 ring-[#C7D2FE] ring-offset-2"
            : done
              ? "border-[#0284C7] bg-[#0284C7] text-white"
              : "border-[#E5E7EB] bg-white text-[#9CA3AF]";

          return (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold ${circleClass}`}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? "✓" : i + 1}
                </div>
              </div>
              {i < n - 1 ? (
                <div
                  className={`mx-1 mb-5 h-[3px] min-w-[8px] flex-1 rounded-full ${segmentDone ? "bg-[#0284C7]" : "bg-[#E5E7EB]"}`}
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
              className="min-w-0 text-center text-[10px] font-semibold leading-snug sm:text-[11px]"
              style={{
                color: current ? "#312E81" : done ? "#0369A1" : "#9CA3AF",
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

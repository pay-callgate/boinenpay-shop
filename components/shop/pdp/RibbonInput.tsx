"use client";

import React from "react";

type Props = {
  leftLabel?: string;
  rightLabel?: string;
  leftValue: string;
  rightValue: string;
  onLeftChange: (v: string) => void;
  onRightChange: (v: string) => void;
  disabled?: boolean;
  leftPlaceholder?: string;
  rightPlaceholder?: string;
};

const inputClass =
  "min-h-11 w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60";

export function RibbonInput({
  leftLabel = "리본 좌측 (보내는 분)",
  rightLabel = "리본 우측 (경조사어)",
  leftValue,
  rightValue,
  onLeftChange,
  onRightChange,
  disabled,
  leftPlaceholder = "예: 홍길동",
  rightPlaceholder = "예: 축하합니다",
}: Props) {
  return (
    <section className="px-6 py-5" aria-label="리본 문구">
      <h3 className="mb-3 text-sm font-bold text-gray-900">리본 문구</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pdp-ribbon-left" className="mb-1.5 block text-xs font-medium text-gray-600">
            {leftLabel}
          </label>
          <input
            id="pdp-ribbon-left"
            type="text"
            value={leftValue}
            onChange={(e) => onLeftChange(e.target.value)}
            disabled={disabled}
            placeholder={leftPlaceholder}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="pdp-ribbon-right" className="mb-1.5 block text-xs font-medium text-gray-600">
            {rightLabel}
          </label>
          <input
            id="pdp-ribbon-right"
            type="text"
            value={rightValue}
            onChange={(e) => onRightChange(e.target.value)}
            disabled={disabled}
            placeholder={rightPlaceholder}
            autoComplete="off"
            className={inputClass}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        주문서에서 수정할 수 있습니다. 미입력 시 주문 단계에서 입력해 주세요.
      </p>
    </section>
  );
}

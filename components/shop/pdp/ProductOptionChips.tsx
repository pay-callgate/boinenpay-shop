"use client";

import React from "react";

export type OptionChipModel = {
  id: string;
  name: string;
  values: string[];
  priceModifier: number | null;
};

type Props = {
  options: OptionChipModel[];
  selected: Record<string, string>;
  onChange: (optionId: string, value: string) => void;
  disabled?: boolean;
  formatExtraPrice: (n: number) => string;
};

export function ProductOptionChips({
  options,
  selected,
  onChange,
  disabled,
  formatExtraPrice,
}: Props) {
  if (!options.length) return null;

  return (
    <section className="px-6 py-5" aria-label="추가 옵션">
      <h3 className="mb-3 text-sm font-bold text-gray-900">추가 옵션</h3>
      <div className="space-y-5">
        {options.map((opt) => (
          <div key={opt.id}>
            <p className="mb-2 text-xs font-medium text-gray-600">{opt.name}</p>
            <div className="flex flex-wrap gap-2">
              {(opt.values ?? []).map((val) => {
                const active = selected[opt.id] === val;
                const extra =
                  opt.priceModifier != null && opt.priceModifier > 0
                    ? `+${formatExtraPrice(opt.priceModifier)}원`
                    : null;
                return (
                  <button
                    key={val}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(opt.id, val)}
                    className={`min-h-11 min-w-[44px] rounded-full border px-4 py-2.5 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? "border-orange-500 bg-orange-50 text-gray-900 shadow-sm"
                        : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
                    }`}
                  >
                    <span className="block">{val}</span>
                    {extra ? (
                      <span className="font-montserrat mt-0.5 block text-xs tabular-nums text-orange-600">
                        {extra}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

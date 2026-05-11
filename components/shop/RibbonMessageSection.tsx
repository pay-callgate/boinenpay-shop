"use client";

import React from "react";
import { checkoutFieldFocusScroll, checkoutInputEnterGoNext } from "@/lib/checkout-form-ux";
import { RIBBON_MESSAGE_PRESETS } from "@/lib/checkout-florist-fields";

export type RibbonMessageSectionProps = {
  inputClass: string;
  labelClass: string;
  textColor: string;
  textMutedColor: string;
  accentClass?: string;
  ribbonSender: string;
  onRibbonSenderChange: (v: string) => void;
  ribbonSameAsOrderer?: boolean;
  onRibbonSameAsOrdererChange?: (checked: boolean) => void;
  ordererNameForSame?: string;
  ribbonPreset: string;
  onRibbonPresetChange: (v: string) => void;
  ribbonMessageCustom: string;
  onRibbonMessageCustomChange: (v: string) => void;
  /** 선택 — 뉴런 `rw_card` (입력 시에만 전송) */
  ribbonCardExtra: string;
  onRibbonCardExtraChange: (v: string) => void;
};

export function RibbonMessageSection(p: RibbonMessageSectionProps) {
  const accent = p.accentClass ?? "accent-[#D6A8E0]";

  return (
    <div className="flex flex-col gap-5">
      <div>
        {p.onRibbonSameAsOrdererChange != null ? (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className={`${p.labelClass} mb-0`} style={{ color: p.textMutedColor }}>
              보내는 분 <span className="text-rose-500">*</span>
            </label>
            <label
              className="flex cursor-pointer items-center gap-2 text-xs font-medium"
              style={{ color: p.textMutedColor }}
            >
              <input
                type="checkbox"
                checked={p.ribbonSameAsOrderer === true}
                onChange={(e) => {
                  const c = e.target.checked;
                  p.onRibbonSameAsOrdererChange!(c);
                  if (c) p.onRibbonSenderChange((p.ordererNameForSame ?? "").trim());
                }}
                className={accent}
              />
              주문자와 동일
            </label>
          </div>
        ) : (
          <label className={p.labelClass} style={{ color: p.textMutedColor }}>
            보내는 분 <span className="text-rose-500">*</span>
          </label>
        )}
        <input
          type="text"
          inputMode="text"
          enterKeyHint="next"
          value={p.ribbonSender}
          onChange={(e) => {
            p.onRibbonSameAsOrdererChange?.(false);
            p.onRibbonSenderChange(e.target.value);
          }}
          onFocus={checkoutFieldFocusScroll}
          onKeyDown={checkoutInputEnterGoNext}
          className={p.inputClass}
          placeholder="예: 주식회사 ○○○ 대표이사 홍길동"
        />
      </div>

      <div>
        <label className={p.labelClass} style={{ color: p.textMutedColor }}>
          리본 경조사어 <span className="text-rose-500">*</span>
        </label>
        <select
          value={p.ribbonPreset}
          onChange={(e) => {
            p.onRibbonPresetChange(e.target.value);
            if (e.target.value !== "__custom__") p.onRibbonMessageCustomChange("");
          }}
          onFocus={checkoutFieldFocusScroll}
          onKeyDown={checkoutInputEnterGoNext}
          enterKeyHint="next"
          className={p.inputClass}
          style={{ color: p.textColor }}
        >
          {RIBBON_MESSAGE_PRESETS.map((pr) => (
            <option key={pr.value} value={pr.value}>
              {pr.label}
            </option>
          ))}
        </select>
        {p.ribbonPreset === "__custom__" && (
          <textarea
            value={p.ribbonMessageCustom}
            onChange={(e) => p.onRibbonMessageCustomChange(e.target.value)}
            onFocus={checkoutFieldFocusScroll}
            rows={3}
            enterKeyHint="done"
            className={`${p.inputClass} mt-3 min-h-[88px] resize-y`}
            placeholder="리본에 들어갈 문구를 입력해 주세요."
          />
        )}
      </div>

      <div>
        <label className={p.labelClass} style={{ color: p.textMutedColor }}>
          카드·추가 문구 <span className="text-xs font-normal">(선택)</span>
        </label>
        <p className="mb-2 text-xs leading-snug" style={{ color: p.textMutedColor }}>
          입력 시 뉴런 <span className="font-mono text-[11px]">rw_card</span>로 전달됩니다.
        </p>
        <textarea
          value={p.ribbonCardExtra}
          onChange={(e) => p.onRibbonCardExtraChange(e.target.value)}
          onFocus={checkoutFieldFocusScroll}
          rows={3}
          enterKeyHint="done"
          className={`${p.inputClass} min-h-[88px] resize-y`}
          placeholder="카드에 넣을 문구가 있으면 입력해 주세요."
        />
      </div>
    </div>
  );
}

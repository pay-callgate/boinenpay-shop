"use client";

import React from "react";
import { checkoutFieldFocusScroll, checkoutInputEnterGoNext } from "@/lib/checkout-form-ux";
import {
  RIBBON_HINT_FLORIST_REQUIRED,
  RIBBON_HINT_OPTIONAL,
  RIBBON_LABEL_MESSAGE_COMBINED_MAIN,
  RIBBON_LABEL_MESSAGE_MAIN,
  RIBBON_LABEL_SENDER_MAIN,
  RIBBON_MESSAGE_PRESETS,
  RIBBON_PLACEHOLDER_MESSAGE_COMBINED,
  RIBBON_PRESET_NONE,
  isRibbonFloristRequired,
} from "@/lib/checkout-florist-fields";

function RibbonFieldLabel({
  labelClass,
  color,
  main,
  hint,
}: {
  labelClass: string;
  color: string;
  main: string;
  hint: string;
}) {
  return (
    <label className={labelClass} style={{ color }}>
      {main}
      <span className="font-normal"> {hint}</span>
    </label>
  );
}

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
  /** 선택 — 카드에 들어갈 추가 문구 (화환 주문·combinedRibbonAndCard=false 일 때만) */
  ribbonCardExtra?: string;
  onRibbonCardExtraChange?: (v: string) => void;
  /** 미지정 시 preset 기준(필요없음 제외). 근조/축하 화환 장바구니는 true 권장 */
  ribbonFieldsRequired?: boolean;
  /** 꽃다발·기타 — 카드 필드 숨기고 리본·카드 문구 단일 텍스트박스 */
  combinedRibbonAndCard?: boolean;
};

export function RibbonMessageSection(p: RibbonMessageSectionProps) {
  const accent = p.accentClass ?? "accent-[#D6A8E0]";
  const combined = p.combinedRibbonAndCard === true;
  const ribbonRequired =
    p.ribbonFieldsRequired ?? isRibbonFloristRequired(p.ribbonPreset);
  const hint = ribbonRequired ? RIBBON_HINT_FLORIST_REQUIRED : RIBBON_HINT_OPTIONAL;
  const messageLabelMain = combined
    ? RIBBON_LABEL_MESSAGE_COMBINED_MAIN
    : RIBBON_LABEL_MESSAGE_MAIN;

  return (
    <div className="flex flex-col gap-5">
      <div>
        {p.onRibbonSameAsOrdererChange != null ? (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <RibbonFieldLabel
              labelClass={`${p.labelClass} mb-0`}
              color={p.textMutedColor}
              main={RIBBON_LABEL_SENDER_MAIN}
              hint={hint}
            />
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
          <RibbonFieldLabel
            labelClass={p.labelClass}
            color={p.textMutedColor}
            main={RIBBON_LABEL_SENDER_MAIN}
            hint={hint}
          />
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
        <RibbonFieldLabel
          labelClass={p.labelClass}
          color={p.textMutedColor}
          main={messageLabelMain}
          hint={hint}
        />
        <select
          value={p.ribbonPreset}
          onChange={(e) => {
            const next = e.target.value;
            p.onRibbonPresetChange(next);
            if (next !== "__custom__") p.onRibbonMessageCustomChange("");
            if (next === RIBBON_PRESET_NONE) {
              p.onRibbonMessageCustomChange("");
              p.onRibbonSameAsOrdererChange?.(false);
            }
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
            placeholder={
              combined
                ? RIBBON_PLACEHOLDER_MESSAGE_COMBINED
                : "리본에 들어갈 문구를 입력해 주세요."
            }
          />
        )}
      </div>

      {/*
      카드·추가 문구 — 주문서 UI 단순화로 임시 비노출 (재활성 시 onRibbonCardExtraChange prop 전달)
      {!combined && p.onRibbonCardExtraChange != null && (
        <div>
          <label className={p.labelClass} style={{ color: p.textMutedColor }}>
            카드·추가 문구 <span className="text-xs font-normal">(선택)</span>
          </label>
          <textarea
            value={p.ribbonCardExtra ?? ""}
            onChange={(e) => p.onRibbonCardExtraChange!(e.target.value)}
            onFocus={checkoutFieldFocusScroll}
            rows={3}
            enterKeyHint="done"
            className={`${p.inputClass} min-h-[88px] resize-y`}
            placeholder="카드에 넣을 문구가 있으면 입력해 주세요."
          />
        </div>
      )}
      */}
    </div>
  );
}

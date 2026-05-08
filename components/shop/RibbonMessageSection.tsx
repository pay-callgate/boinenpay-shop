"use client";

import React from "react";
import { checkoutFieldFocusScroll, checkoutInputEnterGoNext } from "@/lib/checkout-form-ux";
import {
  RIBBON_MESSAGE_PRESETS,
  RIBBON_MESSAGE_KIND_OPTIONS,
  RIBBON_QUICK_PHRASES,
  type RibbonMessageKind,
  presetFromQuickPhrase,
} from "@/lib/checkout-florist-fields";

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
  messageKind: RibbonMessageKind;
  onMessageKindChange: (k: RibbonMessageKind) => void;
  ribbonPreset: string;
  onRibbonPresetChange: (v: string) => void;
  ribbonMessageCustom: string;
  onRibbonMessageCustomChange: (v: string) => void;
  cardPreset: string;
  onCardPresetChange: (v: string) => void;
  cardMessageCustom: string;
  onCardMessageCustomChange: (v: string) => void;
};

function QuickPhraseGrid(props: {
  inputClass: string;
  setPreset: (v: string) => void;
  setCustom: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {RIBBON_QUICK_PHRASES.map((q) => (
        <button
          key={q.value}
          type="button"
          onClick={() => {
            const { preset, custom } = presetFromQuickPhrase(q.value, RIBBON_MESSAGE_PRESETS);
            props.setPreset(preset);
            props.setCustom(custom);
          }}
          className={`${props.inputClass} max-w-[140px] shrink-0 whitespace-pre-line px-3 py-2 text-center text-xs font-semibold leading-tight`}
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}

export function RibbonMessageSection(p: RibbonMessageSectionProps) {
  const accent = p.accentClass ?? "accent-[#D6A8E0]";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className={p.labelClass} style={{ color: p.textMutedColor }}>
          메시지 종류 <span className="text-rose-500">*</span>
        </label>
        <div className="mt-2 flex flex-wrap gap-4">
          {RIBBON_MESSAGE_KIND_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: p.textColor }}>
              <input
                type="radio"
                name="ribbonMessageKind"
                checked={p.messageKind === opt.value}
                onChange={() => p.onMessageKindChange(opt.value)}
                className={accent}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className={`${p.labelClass} mb-2`} style={{ color: p.textMutedColor }}>
          자주 쓰는 경조사어
        </p>
        {p.messageKind === "both" ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-medium" style={{ color: p.textMutedColor }}>
                리본 문구에 적용
              </p>
              <QuickPhraseGrid
                inputClass={p.inputClass}
                setPreset={p.onRibbonPresetChange}
                setCustom={p.onRibbonMessageCustomChange}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium" style={{ color: p.textMutedColor }}>
                카드 문구에 적용
              </p>
              <QuickPhraseGrid
                inputClass={p.inputClass}
                setPreset={p.onCardPresetChange}
                setCustom={p.onCardMessageCustomChange}
              />
            </div>
          </div>
        ) : (
          <QuickPhraseGrid
            inputClass={p.inputClass}
            setPreset={p.onRibbonPresetChange}
            setCustom={p.onRibbonMessageCustomChange}
          />
        )}
      </div>

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
          {p.messageKind === "card"
            ? "카드 문구"
            : p.messageKind === "both"
              ? "리본 경조사어"
              : "리본 경조사어"}{" "}
          <span className="text-rose-500">*</span>
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
            placeholder={
              p.messageKind === "card"
                ? "카드에 들어갈 문구를 입력해 주세요."
                : "리본에 들어갈 문구를 입력해 주세요."
            }
          />
        )}
      </div>

      {p.messageKind === "both" ? (
        <div>
          <label className={p.labelClass} style={{ color: p.textMutedColor }}>
            카드 문구 <span className="text-rose-500">*</span>
          </label>
          <select
            value={p.cardPreset}
            onChange={(e) => {
              p.onCardPresetChange(e.target.value);
              if (e.target.value !== "__custom__") p.onCardMessageCustomChange("");
            }}
            onFocus={checkoutFieldFocusScroll}
            onKeyDown={checkoutInputEnterGoNext}
            enterKeyHint="next"
            className={p.inputClass}
            style={{ color: p.textColor }}
          >
            {RIBBON_MESSAGE_PRESETS.map((pr) => (
              <option key={`c-${pr.value}`} value={pr.value}>
                {pr.label}
              </option>
            ))}
          </select>
          {p.cardPreset === "__custom__" && (
            <textarea
              value={p.cardMessageCustom}
              onChange={(e) => p.onCardMessageCustomChange(e.target.value)}
              onFocus={checkoutFieldFocusScroll}
              rows={3}
              enterKeyHint="done"
              className={`${p.inputClass} mt-3 min-h-[88px] resize-y`}
              placeholder="카드에 들어갈 문구를 입력해 주세요."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

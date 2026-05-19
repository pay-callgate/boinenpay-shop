"use client";

import { useMemo, useState } from "react";
import {
  looksLikePolicyHtml,
  policyPlainTextToSafeHtml,
  stripLeadingPolicyScaffold,
} from "@/lib/policy-plain-format";
import { POLICY_PLAIN_HTML_CLASS } from "@/lib/policy-plain-html-classes";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "notice" as const, label: "상품 고시" },
  { key: "delivery" as const, label: "배송 안내" },
  { key: "refund" as const, label: "환불·취소" },
];

type TabKey = (typeof TABS)[number]["key"];

/** phonePreview용: PDP 본문 15px → ~12px (twMerge로 POLICY_PLAIN_HTML_CLASS 덮어씀) */
const PHONE_PREVIEW_POLICY_TYPO =
  "text-[12px] leading-snug [&_li]:mb-1 [&_li]:text-[12px] [&_li]:leading-snug [&_ul]:my-1.5 [&_ul]:mb-2 [&_p]:mb-1.5";

function bodyToHtml(raw: string): { html: string; mode: "plain" | "raw" } | null {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  const stripped = stripLeadingPolicyScaffold(normalized).trim();
  if (!stripped) return null;
  if (looksLikePolicyHtml(stripped)) {
    return { html: stripped, mode: "raw" };
  }
  const html = policyPlainTextToSafeHtml(normalized);
  return html ? { html, mode: "plain" } : null;
}

/** 쇼핑몰 PDP 정책 탭과 동일한 탭·카드 구조로 통합 미리보기 */
export function InfoTemplatePdpPreview({
  productNotice,
  deliveryInfo,
  refundPolicy,
  accentColor = "#7C3AED",
  /** true: 어드민 미리보기만 모바일 스냅샷에 가깝게 본문·탭 글자 축소 (실제 PDP 렌더와 무관) */
  phonePreview = false,
}: {
  productNotice: string;
  deliveryInfo: string;
  refundPolicy: string;
  accentColor?: string;
  phonePreview?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("notice");

  const text =
    tab === "notice" ? productNotice : tab === "delivery" ? deliveryInfo : refundPolicy;

  const rendered = useMemo(() => bodyToHtml(text), [text]);

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-black/[0.04]">
      <div className="shrink-0 border-b border-slate-200 bg-white px-1">
        <div className="flex" role="tablist" aria-label="쇼핑몰 PDP 미리보기">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={cn(
                  "min-w-0 flex-1 shrink-0 whitespace-nowrap border-b-2 px-1.5 text-center font-semibold transition-colors",
                  phonePreview
                    ? "py-2 text-[10px] sm:text-[11px]"
                    : "py-2.5 text-[11px] sm:text-xs",
                  on ? "border-current text-gray-900" : "border-transparent text-gray-500",
                )}
                style={
                  on ? { color: accentColor, borderBottomColor: accentColor } : undefined
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-3">
        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm ring-1 ring-black/[0.04]">
          <h3
            className={cn(
              "mb-2 font-bold text-gray-900",
              phonePreview ? "text-xs" : "text-sm",
            )}
          >
            {TABS.find((t) => t.key === tab)!.label}
          </h3>
          {!rendered ? (
            <p
              className={cn(
                "leading-relaxed text-slate-400",
                phonePreview ? "text-[11px] leading-snug" : "text-xs",
              )}
            >
              가운데 편집기에서 이 탭에 해당하는 필드에 입력하면, 고객 상품 상세 화면과 같은 스타일로
              표시됩니다.
            </p>
          ) : rendered.mode === "raw" ? (
            <div
              className={cn(
                POLICY_PLAIN_HTML_CLASS,
                phonePreview && PHONE_PREVIEW_POLICY_TYPO,
              )}
              dangerouslySetInnerHTML={{ __html: rendered.html }}
            />
          ) : (
            <div
              className={cn(
                POLICY_PLAIN_HTML_CLASS,
                phonePreview && PHONE_PREVIEW_POLICY_TYPO,
              )}
              dangerouslySetInnerHTML={{ __html: rendered.html }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

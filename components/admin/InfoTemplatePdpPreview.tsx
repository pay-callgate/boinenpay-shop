"use client";

import { useMemo, useState } from "react";
import {
  looksLikePolicyHtml,
  policyPlainTextToSafeHtml,
  stripLeadingPolicyScaffold,
} from "@/lib/policy-plain-format";
import { POLICY_PLAIN_HTML_CLASS } from "@/lib/policy-plain-html-classes";

const TABS = [
  { key: "notice" as const, label: "상품 고시" },
  { key: "delivery" as const, label: "배송 안내" },
  { key: "refund" as const, label: "환불·취소" },
];

type TabKey = (typeof TABS)[number]["key"];

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
}: {
  productNotice: string;
  deliveryInfo: string;
  refundPolicy: string;
  accentColor?: string;
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
                className={`min-w-0 flex-1 shrink-0 whitespace-nowrap border-b-2 px-1.5 py-2.5 text-center text-[11px] font-semibold transition-colors sm:text-xs ${
                  on ? "border-current text-gray-900" : "border-transparent text-gray-500"
                }`}
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
          <h3 className="mb-2 text-sm font-bold text-gray-900">
            {TABS.find((t) => t.key === tab)!.label}
          </h3>
          {!rendered ? (
            <p className="text-xs leading-relaxed text-slate-400">
              가운데 편집기에서 이 탭에 해당하는 필드에 입력하면, 고객 상품 상세 화면과 같은 스타일로
              표시됩니다.
            </p>
          ) : rendered.mode === "raw" ? (
            <div
              className={POLICY_PLAIN_HTML_CLASS}
              dangerouslySetInnerHTML={{ __html: rendered.html }}
            />
          ) : (
            <div
              className={POLICY_PLAIN_HTML_CLASS}
              dangerouslySetInnerHTML={{ __html: rendered.html }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

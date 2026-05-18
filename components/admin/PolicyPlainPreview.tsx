"use client";

import { policyPlainTextToSafeHtml } from "@/lib/policy-plain-format";
import { POLICY_PLAIN_HTML_CLASS } from "@/lib/policy-plain-html-classes";

/** 어드민 — 평문 안내가 PDP에서 어떻게 보일지 미리보기 */
export function PolicyPlainPreview({
  text,
  subtitle,
}: {
  text: string;
  subtitle?: string;
}) {
  const html = policyPlainTextToSafeHtml(text);
  if (!html) {
    return (
      <p className="text-[11px] text-slate-400">
        {subtitle ? `「${subtitle}」` : "내용"}을 입력하면 쇼핑몰과 같은 스타일로 미리볼 수 있습니다.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {subtitle ? (
        <p className="text-[10px] font-medium text-slate-500">미리보기 · {subtitle}</p>
      ) : null}
      <div
        className={`max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 ${POLICY_PLAIN_HTML_CLASS}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/**
 * PDP·어드민 `dangerouslySetInnerHTML` 공통 래퍼.
 * Preflight로 제거된 ul/ol 마커·들여쓰기는 하위 선택자로 복구합니다.
 */
export const POLICY_PLAIN_HTML_CLASS = [
  "policy-injected-html",
  "text-[15px] leading-relaxed text-gray-700",
  "[&_ul]:list-disc [&_ul]:list-inside [&_ul]:my-2 [&_ul]:mb-4 [&_ul]:max-w-none [&_ul]:py-0 [&_ul]:pl-0",
  "[&_ul_ul]:list-[circle] [&_ul_ul]:list-inside [&_ul_ul]:my-1 [&_ul_ul]:mb-2 [&_ul_ul]:py-0 [&_ul_ul]:pl-0",
  "[&_ul_ul_ul]:list-[square] [&_ul_ul_ul]:list-inside [&_ul_ul_ul]:my-1 [&_ul_ul_ul]:mb-2 [&_ul_ul_ul]:py-0 [&_ul_ul_ul]:pl-0",
  "[&_ol]:list-decimal [&_ol]:list-inside [&_ol]:my-2 [&_ol]:mb-4 [&_ol]:py-0 [&_ol]:pl-0",
  "[&_li]:mb-1.5 [&_li]:leading-relaxed [&_li]:text-gray-700",
  "[&_.policy-para-gap]:block [&_.policy-para-gap]:shrink-0",
  "[&_p]:mb-2 [&_p:last-child]:mb-0",
  "[&_p.policy-plain-p]:mb-2",
  "[&_strong.policy-li-strong]:font-semibold [&_strong.policy-li-strong]:text-gray-900",
  "[&_a]:break-words [&_a]:text-blue-600 [&_a]:underline",
  "[&_img]:h-auto [&_img]:max-w-full",
  "[&_div.highlight-box]:box-border [&_div.highlight-box]:min-w-0 [&_div.highlight-box]:max-w-full [&_div.highlight-box]:break-words [&_div.highlight-box]:rounded-xl [&_div.highlight-box]:border [&_div.highlight-box]:border-gray-200 [&_div.highlight-box]:bg-gray-50 [&_div.highlight-box]:px-3.5 [&_div.highlight-box]:py-3",
  "[&_.policy-callout]:box-border [&_.policy-callout]:min-w-0 [&_.policy-callout]:max-w-full [&_.policy-callout]:break-words",
].join(" ");

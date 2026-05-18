"use client";

import React, { useMemo, useState } from "react";
import { ClipboardList, Truck, Undo2 } from "lucide-react";
import { PdpPlaceholderBlock } from "@/components/shop/pdp/PdpPlaceholderBlock";
import {
  looksLikePolicyHtml,
  policyPlainTextToSafeHtml,
  stripLeadingPolicyScaffold,
} from "@/lib/policy-plain-format";
import { POLICY_PLAIN_HTML_CLASS } from "@/lib/policy-plain-html-classes";

/** Shop API `product.policy_tab` 형태 */
export type ProductPolicyTabPayload = {
  delivery_info: string;
  refund_policy: string;
  product_notice: string;
  source?: string;
  template_id?: string | null;
};

type SubTabKey = "notice" | "delivery" | "refund";

const SUB_TABS: {
  key: SubTabKey;
  label: string;
  pick: (p: ProductPolicyTabPayload) => string;
  icon: React.ReactNode;
}[] = [
  {
    key: "notice",
    label: "상품 고시",
    pick: (p) => p.product_notice,
    icon: <ClipboardList className="h-4 w-4" strokeWidth={2} aria-hidden />,
  },
  {
    key: "delivery",
    label: "배송 안내",
    pick: (p) => p.delivery_info,
    icon: <Truck className="h-4 w-4" strokeWidth={2} aria-hidden />,
  },
  {
    key: "refund",
    label: "환불·취소",
    pick: (p) => p.refund_policy,
    icon: <Undo2 className="h-4 w-4" strokeWidth={2} aria-hidden />,
  },
];

function PolicyRichText({ text, accentColor }: { text: string; accentColor: string }) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  const stripped = stripLeadingPolicyScaffold(normalized).trim();
  if (!stripped) {
    return (
      <PdpPlaceholderBlock
        accentColor={accentColor}
        title="안내 준비 중"
        description="판매자가 배송·환불·상품 고시 안내를 등록하면 이곳에 표시됩니다."
      />
    );
  }
  if (looksLikePolicyHtml(stripped)) {
    return (
      <div
        className={POLICY_PLAIN_HTML_CLASS}
        dangerouslySetInnerHTML={{ __html: stripped }}
      />
    );
  }
  const html = policyPlainTextToSafeHtml(normalized);
  if (!html) {
    return (
      <PdpPlaceholderBlock
        accentColor={accentColor}
        title="안내 준비 중"
        description="판매자가 배송·환불·상품 고시 안내를 등록하면 이곳에 표시됩니다."
      />
    );
  }
  return (
    <div
      className={POLICY_PLAIN_HTML_CLASS}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function ProductPolicyPanels({
  policyTab,
  accentColor,
}: {
  policyTab: ProductPolicyTabPayload | null | undefined;
  accentColor: string;
}) {
  const [subTab, setSubTab] = useState<SubTabKey>("notice");

  const payload: ProductPolicyTabPayload = policyTab ?? {
    delivery_info: "",
    refund_policy: "",
    product_notice: "",
    source: "empty",
    template_id: null,
  };

  const activeDef = useMemo(() => SUB_TABS.find((x) => x.key === subTab)!, [subTab]);
  const activeBody = activeDef.pick(payload);

  return (
    <div>
      <div
        className="-mx-1 flex overflow-x-auto border-b border-gray-200 bg-white scrollbar-none"
        role="tablist"
        aria-label="구매 및 배송 안내"
      >
        {SUB_TABS.map((t) => {
          const on = subTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSubTab(t.key)}
              className={`flex min-w-0 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-3 text-xs font-semibold transition-colors sm:text-sm ${
                on ? "border-current text-gray-900" : "border-transparent text-gray-500"
              }`}
              style={on ? { color: accentColor, borderBottomColor: accentColor } : undefined}
            >
              <span className="hidden sm:inline" style={on ? { color: accentColor } : undefined}>
                {t.icon}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        className="mt-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm ring-1 ring-black/[0.04]"
        role="tabpanel"
      >
        <div className="mb-3 flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-gray-100"
            style={{ color: accentColor }}
            aria-hidden
          >
            {activeDef.icon}
          </span>
          <h3 className="text-base font-bold text-gray-900">{activeDef.label}</h3>
        </div>
        <PolicyRichText text={activeBody} accentColor={accentColor} />
      </div>
    </div>
  );
}

"use client";

import React, { useMemo, useState } from "react";
import { ClipboardList, Truck, Undo2 } from "lucide-react";
import { PdpPlaceholderBlock } from "@/components/shop/pdp/PdpPlaceholderBlock";

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
  const t = text.trim();
  if (!t) {
    return (
      <PdpPlaceholderBlock
        accentColor={accentColor}
        title="안내 준비 중"
        description="판매자가 배송·환불·상품 고시 안내를 등록하면 이곳에 표시됩니다."
      />
    );
  }
  if (/<[a-z][\s\S]*>/i.test(t)) {
    return (
      <div
        className="prose prose-sm max-w-none text-gray-800 prose-p:my-2 prose-p:leading-relaxed prose-headings:text-gray-900 prose-ul:my-2 prose-li:my-0.5 [&_img]:h-auto [&_img]:max-w-full"
        dangerouslySetInnerHTML={{ __html: t }}
      />
    );
  }
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{t}</div>
  );
}

export function ProductPolicyPanels({
  policyTab,
  accentColor,
  embedded = false,
}: {
  policyTab: ProductPolicyTabPayload | null | undefined;
  accentColor: string;
  embedded?: boolean;
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
    <div className={embedded ? "bg-transparent" : "bg-white"}>
      {!embedded ? (
        <p className="mb-3 px-1 text-xs text-gray-500">
          상품·배송·환불 정책은 쇼핑몰 설정에 따라 표기됩니다.
        </p>
      ) : null}

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
        className="mt-4 rounded-xl border border-purple-100/80 bg-gradient-to-b from-[#FAF8FC] to-white p-4 shadow-sm"
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

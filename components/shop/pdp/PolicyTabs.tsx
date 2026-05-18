"use client";

import React, { useState } from "react";

type TabKey = "detail" | "policy";

type Props = {
  detailHtml: string | null;
  detailFallback?: React.ReactNode;
};

const POLICY_SECTIONS: { title: string; body: string }[] = [
  {
    title: "배송 안내",
    body:
      "주문 확인 후 제작·포장하여 배송됩니다. 지역·날씨·물류 상황에 따라 도착 시각은 달라질 수 있습니다. 희망 배송일이 있는 경우 주문서에서 날짜·시간대를 지정해 주세요. 설·추석 등 명절 기간에는 일정이 지연될 수 있습니다.",
  },
  {
    title: "취소 및 환불",
    body:
      "상품 제작이 시작된 이후에는 취소가 제한될 수 있습니다. 단순 변심에 의한 교환·반품은 생화 특성상 어려울 수 있으며, 배송 중 훼손·오배송 등 당사 귀책 사유는 사진 확인 후 재배송 또는 환불 절차를 안내드립니다. 자세한 기준은 전자상거래 등에서의 소비자보호에 관한 법령을 따릅니다.",
  },
  {
    title: "상품 유의사항",
    body:
      "생화 제품은 계절·입고에 따라 색상·형태가 이미지와 다를 수 있습니다. 부득이한 경우 동등 이상 가치로 대체 배송될 수 있습니다. 수령 후 가능한 빠른 시일 내에 물을 갈아 주시고 직사광선을 피해 보관해 주세요.",
  },
];

export function PolicyTabs({ detailHtml, detailFallback }: Props) {
  const [tab, setTab] = useState<TabKey>("detail");

  return (
    <div className="border-t border-gray-100">
      <div className="grid grid-cols-2 border-b border-gray-100 bg-white" role="tablist" aria-label="상품 정보">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "detail"}
          onClick={() => setTab("detail")}
          className={`min-h-12 border-b-2 py-3 text-sm font-bold transition-colors ${
            tab === "detail"
              ? "border-orange-500 text-gray-900"
              : "border-transparent text-gray-500"
          }`}
        >
          상세 정보
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "policy"}
          onClick={() => setTab("policy")}
          className={`min-h-12 border-b-2 py-3 text-sm font-bold transition-colors ${
            tab === "policy"
              ? "border-orange-500 text-gray-900"
              : "border-transparent text-gray-500"
          }`}
        >
          배송 및 안내
        </button>
      </div>

      <div className="px-6 py-6" role="tabpanel">
        {tab === "detail" ? (
          detailHtml ? (
            <div
              className="prose prose-sm max-w-none text-gray-800 prose-headings:text-gray-900 prose-p:leading-relaxed prose-img:w-full prose-img:rounded-xl [&_img]:h-auto"
              dangerouslySetInnerHTML={{ __html: detailHtml }}
            />
          ) : (
            detailFallback ?? <p className="text-sm text-gray-500">상세 정보가 없습니다.</p>
          )
        ) : (
          <div className="space-y-6 text-sm leading-relaxed text-gray-800">
            {POLICY_SECTIONS.map((s) => (
              <section key={s.title}>
                <h3 className="mb-2 text-base font-bold text-gray-900">{s.title}</h3>
                <p className="whitespace-pre-line text-gray-700">{s.body}</p>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

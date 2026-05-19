"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PdpPlaceholderBlock } from "@/components/shop/pdp/PdpPlaceholderBlock";

type SectionKey = "detail" | "review" | "qna";

function AccordionRow({
  sectionKey,
  title,
  open,
  onToggle,
  children,
}: {
  sectionKey: SectionKey;
  title: string;
  open: boolean;
  onToggle: (key: SectionKey) => void;
  children: React.ReactNode;
}) {
  const panelId = `pdp-acc-${sectionKey}`;
  const buttonId = `pdp-acc-btn-${sectionKey}`;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        id={buttonId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50/80 active:bg-gray-50/90"
        onClick={() => onToggle(sectionKey)}
      >
        <span className="text-sm font-bold text-gray-900">{title}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${
            open ? "-rotate-180" : ""
          }`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className={open ? "border-t border-gray-100 bg-[#FAFAFA]/80" : undefined}
      >
        {open ? <div className="px-5 py-4">{children}</div> : null}
      </div>
    </div>
  );
}

/** PDP: 상품 상세 / 후기 / Q&A 아코디언 (정책 3탭은 페이지 상단에서 별도 표시) */
export function PdpInfoAccordion({
  productId,
  descriptionHtml,
  accentColor,
  reviewCount = 0,
}: {
  productId: string;
  descriptionHtml: string | null;
  accentColor: string;
  reviewCount?: number;
}) {
  const [openKey, setOpenKey] = useState<SectionKey | null>(null);

  useEffect(() => {
    setOpenKey(null);
  }, [productId]);

  const toggle = (key: SectionKey) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  const hasDetail = Boolean(descriptionHtml?.trim());

  return (
    <div className="overflow-hidden rounded-t-xl border border-gray-100 bg-white shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.08)]">
      <AccordionRow
        sectionKey="detail"
        title="상품 상세"
        open={openKey === "detail"}
        onToggle={toggle}
      >
        {hasDetail ? (
          <div
            className="leading-relaxed text-gray-700 [&_img]:w-full [&_img]:h-auto"
            dangerouslySetInnerHTML={{ __html: descriptionHtml! }}
          />
        ) : (
          <PdpPlaceholderBlock
            accentColor={accentColor}
            description="상세 이미지·설명은 곧 업데이트될 예정이에요. 궁금하신 점은 문의로 남겨 주세요."
          />
        )}
      </AccordionRow>

      <AccordionRow
        sectionKey="review"
        title={`후기(${reviewCount})`}
        open={openKey === "review"}
        onToggle={toggle}
      >
        <PdpPlaceholderBlock
          accentColor={accentColor}
          description="첫 후기를 남겨 주시면 다른 고객님께 큰 도움이 됩니다. 리뷰 기능을 준비하고 있어요."
        />
      </AccordionRow>

      <AccordionRow
        sectionKey="qna"
        title="Q&A"
        open={openKey === "qna"}
        onToggle={toggle}
      >
        <PdpPlaceholderBlock
          accentColor={accentColor}
          description="상품 관련 문의 게시판을 열심히 준비 중입니다. 급하신 문의는 고객센터로 연락 주세요."
        />
      </AccordionRow>
    </div>
  );
}

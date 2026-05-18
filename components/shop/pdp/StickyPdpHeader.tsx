"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { HEADER_HEIGHT } from "@/components/shop/ShopLayout";

type Props = {
  title?: string;
  onBack: () => void;
};

export function StickyPdpHeader({ title = "상품 상세 정보", onBack }: Props) {
  return (
    <header
      className="sticky z-30 flex min-h-[52px] items-center border-b border-gray-100 bg-white px-2 py-2 shadow-sm"
      style={{ top: HEADER_HEIGHT }}
    >
      <button
        type="button"
        onClick={onBack}
        className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-900 transition-colors hover:bg-gray-100 active:bg-gray-100"
        aria-label="뒤로"
      >
        <ArrowLeft className="size-5" strokeWidth={2} aria-hidden />
      </button>
      <h1 className="w-full truncate px-12 text-center text-base font-bold text-gray-900">{title}</h1>
    </header>
  );
}

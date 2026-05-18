"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export function PdpPlaceholderBlock({
  accentColor,
  title = "준비 중입니다",
  description,
}: {
  accentColor: string;
  title?: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-purple-200/80 bg-gradient-to-b from-[#FAF8FC] to-white px-5 py-8 text-center">
      <div
        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-purple-100/90"
        style={{ color: accentColor }}
        aria-hidden
      >
        <Sparkles className="h-5 w-5" strokeWidth={2} />
      </div>
      <p className="text-[15px] font-bold tracking-tight text-gray-900">{title}</p>
      <p className="mx-auto mt-2 max-w-[260px] text-xs leading-relaxed text-gray-500">
        {description}
      </p>
    </div>
  );
}

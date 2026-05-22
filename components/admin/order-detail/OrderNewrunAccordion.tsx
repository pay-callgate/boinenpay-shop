"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  children: ReactNode;
};

/** Vercel 프로덕션 배포에서만 검증용 UI 비노출 (로컬·프리뷰는 유지) */
const hideVerificationUi =
  process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

export function OrderNewrunAccordion({ children }: Props) {
  const [open, setOpen] = useState(false);

  if (hideVerificationUi) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
        aria-expanded={open}
      >
        <div>
          <span className="font-semibold text-[#111]">
            ▶ [검증용] 뉴런 발주 - 협회 검색 (클릭하여 펼치기)
          </span>
          <p className="mt-1 text-xs text-gray-600">
            * [검증용] 결제 완료 후 자동 발주 처리됨. (오픈 시 삭제 예정 영역)
          </p>
        </div>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-gray-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="border-t border-gray-200 p-4">{children}</div> : null}
    </div>
  );
}

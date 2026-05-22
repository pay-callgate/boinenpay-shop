"use client";

import { FileText } from "lucide-react";
import { ADMIN_PAGE_HEADER_CARD_CLASS } from "@/components/admin/AdminPageHeader";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABELS,
  isOrderStatusHighlightActive,
} from "./order-detail-constants";

type Props = {
  status: string;
};

export function OrderDetailHeader({ status }: Props) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const highlight = isOrderStatusHighlightActive(status);

  return (
    <header className={cn("mb-6", ADMIN_PAGE_HEADER_CARD_CLASS)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90 sm:text-xs">
            Orders · Detail
          </p>
          <h1 className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            <FileText
              className="h-6 w-6 shrink-0 text-emerald-600 sm:h-7 sm:w-7"
              strokeWidth={1.75}
              aria-hidden
            />
            주문 상세
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-600 sm:text-sm break-keep [word-break:keep-all]">
            주문·결제·배송 정보를 한눈에 확인하고, 필요한 경우 결제를 취소할 수 있습니다.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-1 sm:items-end">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">
            현재 상태
          </span>
          <span
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm ${
              highlight
                ? "bg-orange-500 text-white"
                : "border border-slate-200 bg-white text-slate-900"
            }`}
          >
            {label}
          </span>
        </div>
      </div>
    </header>
  );
}

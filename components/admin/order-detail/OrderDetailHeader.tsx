"use client";

import { ArrowLeft } from "lucide-react";
import {
  ORDER_STATUS_LABELS,
  isOrderStatusHighlightActive,
} from "./order-detail-constants";

type Props = {
  orderNo: string;
  status: string;
  onBack: () => void;
};

export function OrderDetailHeader({ orderNo, status, onBack }: Props) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const highlight = isOrderStatusHighlightActive(status);

  return (
    <header className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            주문 목록으로
          </button>
          <div className="hidden h-6 w-px bg-gray-200 sm:block" aria-hidden />
          <h1 className="text-lg font-bold text-gray-900 sm:text-xl">
            주문상세: <span className="font-mono">{orderNo}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">현재상태</span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
              highlight
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-900"
            }`}
          >
            {label}
          </span>
        </div>
      </div>
    </header>
  );
}

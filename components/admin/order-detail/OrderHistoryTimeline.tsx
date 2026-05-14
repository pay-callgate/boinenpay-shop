"use client";

import { History } from "lucide-react";
import { ORDER_STATUS_LABELS, isOrderStatusHighlightActive } from "./order-detail-constants";

export type StatusHistoryItem = {
  id: string;
  status: string;
  memo: string | null;
  created_at: string;
};

type Props = {
  history: StatusHistoryItem[];
  formatDate: (iso: string) => string;
};

export function OrderHistoryTimeline({ history, formatDate }: Props) {
  if (history.length === 0) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4 text-lg font-bold text-gray-900">
          <History className="h-5 w-5 shrink-0 text-gray-900" aria-hidden />
          상태 변경 이력
        </h2>
        <p className="py-6 text-center text-sm font-medium text-gray-500">이력이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4 text-lg font-bold text-gray-900">
        <History className="h-5 w-5 shrink-0 text-gray-900" aria-hidden />
        상태 변경 이력
      </h2>
      <ul className="relative ms-1 space-y-0 border-l-2 border-gray-100 pl-6">
        {history.map((h) => {
          const label = ORDER_STATUS_LABELS[h.status] || h.status;
          const hot = isOrderStatusHighlightActive(h.status);
          return (
            <li key={h.id} className="relative pb-6 last:pb-0">
              <span className="absolute -left-[13px] top-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500 ring-2 ring-white" />
              <div className="text-xs font-medium text-gray-500">{formatDate(h.created_at)}</div>
              <div
                className={`mt-0.5 text-sm font-semibold ${
                  hot ? "text-orange-500" : "text-gray-900"
                }`}
              >
                {label}
              </div>
              {h.memo ? (
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-500">{h.memo}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { RefreshCw } from "lucide-react";
import { COURIER_OPTIONS } from "@/lib/courier";
import { ORDER_STATUS_OPTIONS } from "./order-detail-constants";

type Props = {
  newStatus: string;
  onStatusChange: (v: string) => void;
  courierCompany: string;
  onCourierChange: (v: string) => void;
  trackingNumber: string;
  onTrackingChange: (v: string) => void;
  memo: string;
  onMemoChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  updating: boolean;
  newrunCourierLocked: boolean;
};

export function OrderStatusPanel({
  newStatus,
  onStatusChange,
  courierCompany,
  onCourierChange,
  trackingNumber,
  onTrackingChange,
  memo,
  onMemoChange,
  onSubmit,
  updating,
  newrunCourierLocked,
}: Props) {
  const fieldClass =
    "w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 outline-none transition-shadow focus:border-black focus:ring-2 focus:ring-black";
  const disabledField = newrunCourierLocked
    ? " cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500 focus:ring-0"
    : "";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4 text-lg font-bold text-gray-900">
        <RefreshCw className="h-5 w-5 shrink-0 text-gray-900" aria-hidden />
        주문 상태 업데이트
      </h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-500">주문 상태</label>
          <select
            value={newStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            required
            className={fieldClass}
          >
            {ORDER_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs leading-snug text-gray-500">
            뉴런 배송 콜백이 상태를 자동 갱신할 수 있습니다.
          </p>
        </div>

        {newrunCourierLocked ? (
          <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-900">
            뉴런 발주·협회 배송 연동 주문입니다. 택배사·송장은 협회 배송 흐름을 사용하므로 여기서 수정할 수
            없습니다.
          </p>
        ) : null}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-500">택배사 선택</label>
          <select
            value={courierCompany}
            onChange={(e) => onCourierChange(e.target.value)}
            disabled={newrunCourierLocked}
            className={fieldClass + disabledField}
          >
            {COURIER_OPTIONS.map((opt) => (
              <option key={opt.value || "none"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-500">송장 번호</label>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => onTrackingChange(e.target.value)}
            placeholder="송장번호 입력..."
            disabled={newrunCourierLocked}
            className={fieldClass + disabledField}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-500">변경 메모</label>
          <textarea
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
            placeholder="선택 입력..."
            rows={3}
            className={fieldClass + " min-h-[88px] resize-y"}
          />
        </div>
        <button
          type="submit"
          disabled={updating}
          className="w-full rounded-lg bg-black py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updating ? "저장 중…" : "상태 업데이트 (저장)"}
        </button>
      </form>
    </section>
  );
}

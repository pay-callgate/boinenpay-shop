"use client";

import { Calendar, Pencil } from "lucide-react";
import {
  formatAdminDeliveryMethod,
  formatDesiredDeliveryDateTimeLine,
} from "@/lib/admin-florist-order-display";

type Props = {
  desiredDeliveryDate: string | null | undefined;
  deliveryTimeSlot: string | null | undefined;
  deliveryMethod: string | null | undefined;
  deliveryRequestMemo: string | null | undefined;
  ribbonSender: string | null | undefined;
  ribbonMessage: string | null | undefined;
  ribbonCardMessage: string | null | undefined;
  floristDesiredDeliveryIsToday: boolean;
  onEditRibbon?: () => void;
};

export function OrderFloristRibbonCard({
  desiredDeliveryDate,
  deliveryTimeSlot,
  deliveryMethod,
  deliveryRequestMemo,
  ribbonSender,
  ribbonMessage,
  ribbonCardMessage,
  floristDesiredDeliveryIsToday,
  onEditRibbon,
}: Props) {
  const dateTimeLine = formatDesiredDeliveryDateTimeLine(
    desiredDeliveryDate,
    deliveryTimeSlot
  );
  const urgent = floristDesiredDeliveryIsToday;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2 border-b border-gray-100 pb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <span className="text-xl leading-none" aria-hidden>
            🎀
          </span>
          화훼 배송 및 리본 정보
        </h2>
        {onEditRibbon ? (
          <button
            type="button"
            onClick={onEditRibbon}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-orange-500 hover:text-orange-600"
          >
            <Pencil className="h-3.5 w-3.5" />
            수정
          </button>
        ) : null}
      </div>

      <div
        className={`rounded-lg px-3 py-2.5 text-sm ${
          urgent
            ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200"
            : "bg-gray-50 text-gray-900"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-orange-500" />
          <span className="font-medium text-gray-700">희망 배송 일시</span>
          <span className="font-semibold text-orange-500">{dateTimeLine || "—"}</span>
          {urgent ? (
            <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              오늘 배송
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-4 rounded-lg bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-900">리본·카드 메시지</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-orange-500">
                좌 · 보내는 분
              </span>
              {onEditRibbon ? (
                <button
                  type="button"
                  onClick={onEditRibbon}
                  className="text-xs font-medium text-orange-500 hover:underline"
                >
                  수정
                </button>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm font-medium text-gray-900">
              {ribbonSender?.trim() || "—"}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-orange-500">
                우 · 경조사어
              </span>
              {onEditRibbon ? (
                <button
                  type="button"
                  onClick={onEditRibbon}
                  className="text-xs font-medium text-orange-500 hover:underline"
                >
                  수정
                </button>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm font-medium text-gray-900">
              {ribbonMessage?.trim() || "—"}
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-3">
          <span className="text-xs font-semibold text-gray-500">카드·추가 문구</span>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-gray-900">
            {ribbonCardMessage?.trim() || "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-gray-100 pt-4">
        <div className="min-w-0">
          <span className="block text-sm font-medium text-gray-500">배송 방식</span>
          <p className="text-sm font-medium text-gray-900">
            {formatAdminDeliveryMethod(deliveryMethod)}
          </p>
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-medium text-gray-500">배송 메모</span>
          <p className="whitespace-pre-wrap break-words text-sm font-medium text-gray-900">
            {deliveryRequestMemo?.trim() || "—"}
          </p>
        </div>
      </div>
    </section>
  );
}

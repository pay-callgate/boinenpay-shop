"use client";

import { ShoppingBag } from "lucide-react";
import type { CheckoutResumeOrder } from "@/lib/viewpay-checkout-context";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR").format(price);
}

type PendingOrderInfoBoxProps = {
  order: CheckoutResumeOrder;
  className?: string;
};

/**
 * 진행 중인 주문 — 상품 썸네일 + 상품명 + 주문번호 + 결제금액
 * (PendingOffer 모달 · CheckoutOrderGuidePending 공통)
 */
export function PendingOrderInfoBox({ order, className = "" }: PendingOrderInfoBoxProps) {
  const preview = order.preview;
  const displayTitle =
    preview?.displayTitle ?? preview?.primaryProductName ?? "주문 상품";
  const thumbnailUrl = preview?.thumbnailUrl?.trim() || null;

  return (
    <div
      className={`rounded-xl bg-purple-50 px-4 py-4 text-left text-sm ${className}`.trim()}
    >
      <div className="flex flex-row items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              aria-hidden
            >
              <ShoppingBag
                className="h-6 w-6 text-gray-300"
                strokeWidth={1.75}
              />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-snug text-gray-900 break-keep [word-break:keep-all]">
            {displayTitle}
          </p>
          <p className="mt-1.5 text-sm text-gray-600">
            주문번호{" "}
            <span className="font-semibold text-gray-800">{order.orderNo}</span>
          </p>
          <p className="mt-0.5 text-sm text-gray-600">
            결제 금액{" "}
            <span className="font-bold text-gray-900">
              {formatPrice(order.totalAmount)}원
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

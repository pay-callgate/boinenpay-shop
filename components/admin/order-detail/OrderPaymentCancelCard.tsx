"use client";

import { AlertTriangle } from "lucide-react";

type PartnerPaymentCancel = {
  allowed: boolean;
  message: string | null;
} | null;

type Props = {
  partnerPaymentCancel: PartnerPaymentCancel;
  paymentCancelReason: string;
  onReasonChange: (v: string) => void;
  paymentCancelSubmitting: boolean;
  onSubmitCancel: () => void | Promise<void>;
  orderPaymentStatus: string;
  orderStatus: string;
};

export function OrderPaymentCancelCard({
  partnerPaymentCancel,
  paymentCancelReason,
  onReasonChange,
  paymentCancelSubmitting,
  onSubmitCancel,
  orderPaymentStatus,
  orderStatus,
}: Props) {
  const isDelivered = orderStatus === "delivered";
  const isCancelled = orderStatus === "cancelled";
  const isPaid = orderPaymentStatus === "paid";
  const showReasonField = isPaid && !isCancelled && !isDelivered && partnerPaymentCancel?.allowed;
  const orderCancelDisabled =
    paymentCancelSubmitting ||
    isDelivered ||
    isCancelled ||
    !isPaid ||
    !partnerPaymentCancel?.allowed ||
    (showReasonField && paymentCancelReason.trim().length < 4);

  return (
    <section className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm ring-1 ring-blue-100/80">
      <h2 className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4 text-lg font-bold text-gray-900">
        <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" aria-hidden />
        결제 취소
      </h2>

      {partnerPaymentCancel && !partnerPaymentCancel.allowed && (
        <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
          {partnerPaymentCancel.message ?? "현재 결제 취소할 수 없습니다."}
        </p>
      )}

      {showReasonField ? (
        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-medium text-gray-500">취소 사유 (필수, 4자 이상)</span>
          <textarea
            value={paymentCancelReason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 outline-none focus:border-black focus:ring-2 focus:ring-black"
            placeholder="예: 고객 전화 요청, 품절 확인 등"
          />
        </label>
      ) : null}

      <button
        type="button"
        onClick={onSubmitCancel}
        disabled={orderCancelDisabled}
        className="w-full rounded-lg bg-black py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {paymentCancelSubmitting ? "처리 중…" : "주문 취소"}
      </button>

      <ul className="mt-4 space-y-2 text-xs leading-relaxed text-gray-600">
        <li>
          ※ 결제 취소는 결제 완료 ~ 배송 중 상태일때만 가능하며, 주문 취소 및 전액 환불 가능합니다.
        </li>
        <li>※ 배송 완료 후에는 결제 취소가 불가하여, 취소 버튼은 비활성화됩니다.</li>
      </ul>
    </section>
  );
}

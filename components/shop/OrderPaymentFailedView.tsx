"use client";

import { AlertCircle } from "lucide-react";

const PRIMARY = "#D6A8E0";
const PRIMARY_LIGHT = "#F3E8F5";

export type OrderPaymentFailedViewProps = {
  errorCode?: string;
  errorReason?: string;
  onReturnToCheckout: () => void;
};

function formatErrorCodeLabel(code?: string, reason?: string): string {
  const c = code?.trim();
  if (!c) return reason?.trim() || "알 수 없는 오류";
  const r = reason?.trim();
  if (r && r.includes(c)) return r;
  if (c === "7001") return `${c} (PG사 통신 지연)`;
  if (c === "500") return `${c} (서버 오류)`;
  return r ? `${c} (${r})` : c;
}

/**
 * 결제 실패 전용 UI — order/complete 성공 헤더와 동일 톤
 */
export function OrderPaymentFailedView({
  errorCode,
  errorReason,
  onReturnToCheckout,
}: OrderPaymentFailedViewProps) {
  const errorLabel = formatErrorCodeLabel(errorCode, errorReason);

  return (
    <div className="break-keep [word-break:keep-all]">
      <div className="flex flex-col items-center px-4 pb-2 pt-6">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full ring-2 ring-[#D6A8E0]/40"
          style={{ backgroundColor: PRIMARY_LIGHT }}
          aria-hidden
        >
          <AlertCircle className="h-8 w-8" strokeWidth={2.25} style={{ color: PRIMARY }} />
        </div>
        <h1 className="mt-6 px-2 text-center text-xl font-bold leading-snug tracking-tight text-gray-900 sm:text-[1.35rem]">
          결제 요청이 완료되지 않았습니다.
        </h1>
        <p className="mt-3 max-w-[22rem] px-2 text-center text-sm leading-relaxed text-gray-500">
          일시적인 통신 오류이거나 결제사 서버 응답이 지연되었습니다. 결제 금액은 청구되지
          않았으니 안심하셔도 됩니다.
        </p>
        <div className="mt-7 flex justify-center px-4">
          <div className="inline-flex max-w-full items-center rounded-full bg-gray-100 px-5 py-2.5 shadow-sm">
            <p className="min-w-0 text-center text-[0.7rem] leading-snug tracking-wide text-gray-500">
              ERROR CODE.{" "}
              <span className="text-sm font-bold text-gray-900 break-all sm:break-keep">
                {errorLabel}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-4 mt-8 pb-6">
        <button
          type="button"
          onClick={onReturnToCheckout}
          className="flex w-full items-center justify-center rounded-xl py-4 text-base font-bold text-white transition-opacity hover:opacity-95 active:opacity-90"
          style={{ backgroundColor: PRIMARY }}
        >
          주문서로 돌아가기
        </button>
      </div>
    </div>
  );
}

export const ORDER_PAYMENT_PAGE_BG = "#F9FAFB";
export const ORDER_PAYMENT_WHITE_CARD =
  "mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-sm";

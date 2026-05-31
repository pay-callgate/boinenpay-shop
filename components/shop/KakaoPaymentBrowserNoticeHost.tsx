"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  resolveKakaoExternalPaymentConfirm,
  subscribeKakaoExternalPaymentConfirm,
} from "@/lib/confirm-kakao-external-payment";

const PRIMARY = "#D6A8E0";
const PRIMARY_LIGHT = "#F3E8F5";
const TEXT = "#333333";
const TEXT_MUTED = "#6B7280";

/**
 * Android 카카오톡 인앱 — 결제창 외부 브라우저 안내 모달 (ShopLayout 전역 Host)
 */
export function KakaoPaymentBrowserNoticeHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return subscribeKakaoExternalPaymentConfirm(() => setOpen(true));
  }, []);

  const close = (confirmed: boolean) => {
    setOpen(false);
    resolveKakaoExternalPaymentConfirm(confirmed);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kakao-payment-notice-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: PRIMARY_LIGHT }}
          >
            <ExternalLink className="h-7 w-7" style={{ color: PRIMARY }} strokeWidth={2} />
          </div>
          <h2 id="kakao-payment-notice-title" className="text-lg font-bold" style={{ color: TEXT }}>
            외부 브라우저에서 결제
          </h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
            결제창이 외부 브라우저에서 열립니다.
            <br />
            완료 후 다시 이 화면으로 돌아와 주세요.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => close(true)}
            className="w-full rounded-xl py-3.5 text-sm font-bold text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            확인하고 결제하기
          </button>
          <button
            type="button"
            onClick={() => close(false)}
            className="w-full rounded-xl border-2 bg-white py-3.5 text-sm font-bold"
            style={{ borderColor: PRIMARY, color: PRIMARY }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

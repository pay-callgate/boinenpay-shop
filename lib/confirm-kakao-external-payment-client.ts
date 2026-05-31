"use client";

import {
  isAndroidUserAgent,
  isKakaoTalkInAppBrowser,
} from "@/lib/kakao-in-app-browser";
import { requestKakaoExternalPaymentConfirm } from "@/lib/confirm-kakao-external-payment";

/** Android 카카오톡 IAB에서만 결제 전 안내 모달 */
export async function confirmKakaoExternalPaymentIfNeeded(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  const ua = navigator.userAgent;
  if (!isKakaoTalkInAppBrowser(ua) || !isAndroidUserAgent(ua)) return true;
  return requestKakaoExternalPaymentConfirm();
}

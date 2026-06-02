"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/components/shop/ToastContext";

const USER_CANCEL_TOAST =
  "결제를 취소하셨습니다.\n다른 결제 수단으로 다시 시도해 주세요.";

const DEDUPE_STORAGE_PREFIX = "viewpay_user_cancel_toast:";

/** Strict Mode·searchParams 재렌더 시 동일 landing 1회만 Toast */
function shouldShowUserCancelToast(searchParams: URLSearchParams): boolean {
  if (typeof window === "undefined") return true;
  const key = `${DEDUPE_STORAGE_PREFIX}${window.location.pathname}?${searchParams.toString()}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

/**
 * checkout / guest-order 공통 — Track 1 user_cancel Toast
 * `?error=user_cancel` 또는 레거시 `?cancel=1`
 */
export function useViewpayUserCancelToast(onDetected?: () => void): void {
  const searchParams = useSearchParams();
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    const error = searchParams?.get("error");
    const legacyCancel = searchParams?.get("cancel");
    if (error !== "user_cancel" && legacyCancel !== "1") return;

    if (!shouldShowUserCancelToast(searchParams)) {
      onDetectedRef.current?.();
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        url.searchParams.delete("cancel");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
      return;
    }

    toast(USER_CANCEL_TOAST, "info");
    onDetectedRef.current?.();

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      url.searchParams.delete("cancel");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams]);
}

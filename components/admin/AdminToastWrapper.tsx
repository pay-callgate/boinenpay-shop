"use client";

import { ToastProvider } from "@/components/shop/ToastContext";

/** 어드민 대시보드용 토스트 래퍼. alert 대신 toast 사용 */
export function AdminToastWrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

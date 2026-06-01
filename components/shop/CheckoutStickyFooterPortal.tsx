"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isIosTouchDevice } from "@/lib/ios-touch-device";
import {
  CHECKOUT_STICKY_FOOTER_HEIGHT_FALLBACK,
  CHECKOUT_STICKY_FOOTER_HEIGHT_VAR,
  CHECKOUT_STICKY_ABOVE_NAV_VAR,
} from "@/lib/checkout-tunnel-layout";

type CheckoutStickyFooterPortalProps = {
  stickyAboveNav: number;
  borderColor: string;
  /** lg 브레이크포인트에서 checkout과 동일한 넓은 정렬 */
  wideOnDesktop?: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * 결제 터널 CTA: `<main overflow-y-auto>` 밖(document.body)에 포털.
 * iOS WebView에서 main 내부 fixed가 잘리는 버그 회피.
 * Android·PC: ResizeObserver·visualViewport 보정 미실행.
 */
export function CheckoutStickyFooterPortal({
  stickyAboveNav,
  borderColor,
  wideOnDesktop = false,
  className = "",
  children,
}: CheckoutStickyFooterPortalProps) {
  const [mounted, setMounted] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isIosTouchDevice()) return;
    const el = footerRef.current;
    if (!el) return;

    const root = document.documentElement;

    const applyHeight = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      root.style.setProperty(
        CHECKOUT_STICKY_FOOTER_HEIGHT_VAR,
        `${Math.max(height, CHECKOUT_STICKY_FOOTER_HEIGHT_FALLBACK)}px`
      );
    };

    applyHeight();
    const observer = new ResizeObserver(applyHeight);
    observer.observe(el);

    return () => {
      observer.disconnect();
      root.style.removeProperty(CHECKOUT_STICKY_FOOTER_HEIGHT_VAR);
    };
  }, [mounted]);

  if (!mounted) return null;

  const widthClass = wideOnDesktop
    ? "max-w-[430px] lg:max-w-6xl"
    : "max-w-[430px]";

  return createPortal(
    <div
      ref={footerRef}
      data-checkout-sticky-footer
      className={`checkout-sticky-footer fixed left-0 right-0 z-50 mx-auto border-t bg-white px-4 pt-4 ${widthClass} ${className}`}
      style={
        {
          borderColor,
          [CHECKOUT_STICKY_ABOVE_NAV_VAR]: `${stickyAboveNav}px`,
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        } as React.CSSProperties
      }
    >
      {children}
    </div>,
    document.body
  );
}

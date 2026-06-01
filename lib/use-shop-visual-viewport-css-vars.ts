"use client";

import { useEffect } from "react";
import { CHECKOUT_KEYBOARD_SCROLL_CUSHION_VAR } from "@/lib/checkout-tunnel-layout";
import { isIosTouchDevice } from "@/lib/ios-touch-device";

export const SHOP_VIEWPORT_HEIGHT_VAR = "--shop-viewport-height";
export const SHOP_VISUAL_VIEWPORT_BOTTOM_VAR = "--shop-visual-viewport-bottom";

/** 키보드가 열렸을 때 폼 하단에 추가할 스크롤 여유(px) */
const KEYBOARD_OPEN_SCROLL_CUSHION_PX = 24;

/**
 * visualViewport → CSS 변수 (iOS·Android·PC 공통).
 * 키보드 미표시 시 bottom inset ≈ 0. iOS 전용 signup 보정은 data-ios-touch 유지.
 */
export function useShopVisualViewportCssVars(): void {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const root = document.documentElement;
    const isIos = isIosTouchDevice();
    if (isIos) {
      root.dataset.iosTouch = "true";
    }

    let rafId = 0;

    const applyViewportVars = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const visualViewport = window.visualViewport;
        const viewportHeight = visualViewport?.height ?? window.innerHeight;
        const viewportBottomInset = visualViewport
          ? Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
          : 0;

        root.style.setProperty(SHOP_VIEWPORT_HEIGHT_VAR, `${Math.round(viewportHeight)}px`);
        root.style.setProperty(
          SHOP_VISUAL_VIEWPORT_BOTTOM_VAR,
          `${Math.round(viewportBottomInset)}px`
        );
        root.style.setProperty(
          CHECKOUT_KEYBOARD_SCROLL_CUSHION_VAR,
          viewportBottomInset > 0 ? `${KEYBOARD_OPEN_SCROLL_CUSHION_PX}px` : "0px"
        );
      });
    };

    applyViewportVars();
    window.addEventListener("resize", applyViewportVars);
    window.addEventListener("orientationchange", applyViewportVars);
    window.visualViewport?.addEventListener("resize", applyViewportVars);
    window.visualViewport?.addEventListener("scroll", applyViewportVars);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", applyViewportVars);
      window.removeEventListener("orientationchange", applyViewportVars);
      window.visualViewport?.removeEventListener("resize", applyViewportVars);
      window.visualViewport?.removeEventListener("scroll", applyViewportVars);
      root.style.removeProperty(SHOP_VIEWPORT_HEIGHT_VAR);
      root.style.removeProperty(SHOP_VISUAL_VIEWPORT_BOTTOM_VAR);
      root.style.removeProperty(CHECKOUT_KEYBOARD_SCROLL_CUSHION_VAR);
      if (isIos) {
        delete root.dataset.iosTouch;
      }
    };
  }, []);
}

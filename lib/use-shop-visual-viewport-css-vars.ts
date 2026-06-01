"use client";

import { useEffect } from "react";
import { isIosTouchDevice } from "@/lib/ios-touch-device";

export const SHOP_VIEWPORT_HEIGHT_VAR = "--shop-viewport-height";
export const SHOP_VISUAL_VIEWPORT_BOTTOM_VAR = "--shop-visual-viewport-bottom";

/** iOS/iPadOS 전용: visualViewport → CSS 변수. Android·PC에서는 no-op. */
export function useShopVisualViewportCssVars(): void {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (!isIosTouchDevice()) return;

    const root = document.documentElement;
    root.dataset.iosTouch = "true";

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
      delete root.dataset.iosTouch;
    };
  }, []);
}

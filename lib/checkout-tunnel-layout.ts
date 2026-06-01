import type { CSSProperties } from "react";
import { HEADER_HEIGHT } from "@/components/shop/ShopLayout";

export const CHECKOUT_STICKY_FOOTER_HEIGHT_FALLBACK = 136;
export const CHECKOUT_STICKY_FOOTER_HEIGHT_VAR = "--checkout-sticky-footer-height";
export const CHECKOUT_STICKY_ABOVE_NAV_VAR = "--checkout-sticky-above-nav";
/** 가상 키보드 표시 시 폼 하단 추가 스크롤 여유(px 문자열, 예: 24px) */
export const CHECKOUT_KEYBOARD_SCROLL_CUSHION_VAR = "--checkout-keyboard-scroll-cushion";

export function checkoutTunnelMinHeight(): string {
  return `calc(var(--shop-viewport-height, 100svh) - ${HEADER_HEIGHT}px)`;
}

export function checkoutTunnelFormStyle(stickyAboveNav: number): CSSProperties {
  return {
    minHeight: checkoutTunnelMinHeight(),
    [CHECKOUT_STICKY_ABOVE_NAV_VAR]: `${stickyAboveNav}px`,
  } as CSSProperties;
}

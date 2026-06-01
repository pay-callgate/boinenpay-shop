import type { CSSProperties } from "react";
import { HEADER_HEIGHT } from "@/components/shop/ShopLayout";

export const CHECKOUT_STICKY_FOOTER_HEIGHT_FALLBACK = 136;
export const CHECKOUT_STICKY_FOOTER_HEIGHT_VAR = "--checkout-sticky-footer-height";
export const CHECKOUT_STICKY_ABOVE_NAV_VAR = "--checkout-sticky-above-nav";

export function checkoutTunnelMinHeight(): string {
  return `calc(var(--shop-viewport-height, 100svh) - ${HEADER_HEIGHT}px)`;
}

export function checkoutTunnelFormStyle(stickyAboveNav: number): CSSProperties {
  return {
    minHeight: checkoutTunnelMinHeight(),
    [CHECKOUT_STICKY_ABOVE_NAV_VAR]: `${stickyAboveNav}px`,
  } as CSSProperties;
}

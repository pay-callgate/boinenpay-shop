import type { FocusEvent, KeyboardEvent } from "react";
import {
  CHECKOUT_KEYBOARD_SCROLL_CUSHION_VAR,
  CHECKOUT_STICKY_FOOTER_HEIGHT_VAR,
} from "@/lib/checkout-tunnel-layout";
import { SHOP_VISUAL_VIEWPORT_BOTTOM_VAR } from "@/lib/use-shop-visual-viewport-css-vars";

function readCssPxVar(name: string, fallback: number): number {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function keyboardObstacleHeightPx(): number {
  const footerH = readCssPxVar(CHECKOUT_STICKY_FOOTER_HEIGHT_VAR, 136);
  const keyboardInset = readCssPxVar(SHOP_VISUAL_VIEWPORT_BOTTOM_VAR, 0);
  const cushion = readCssPxVar(CHECKOUT_KEYBOARD_SCROLL_CUSHION_VAR, 0);
  return footerH + keyboardInset + cushion + 8;
}

/** 가상 키보드·고정 CTA에 가리지 않도록 포커스 필드를 스크롤 */
export function checkoutFieldFocusScroll(e: FocusEvent<HTMLElement>): void {
  const el = e.currentTarget;
  const scrollRoot = el.closest("[data-shop-main-scroll]") as HTMLElement | null;

  const run = () => {
    const vv = window.visualViewport;
    const viewportTop = vv?.offsetTop ?? 0;
    const viewportBottom = viewportTop + (vv?.height ?? window.innerHeight);
    const obstacle = keyboardObstacleHeightPx();
    const visibleBottom = viewportBottom - obstacle;
    const rect = el.getBoundingClientRect();

    if (rect.bottom > visibleBottom) {
      const delta = rect.bottom - visibleBottom;
      if (scrollRoot) {
        scrollRoot.scrollBy({ top: delta, behavior: "smooth" });
      } else {
        window.scrollBy({ top: delta, behavior: "smooth" });
      }
      return;
    }

    const headerClearance = 72;
    if (rect.top < viewportTop + headerClearance) {
      if (scrollRoot) {
        scrollRoot.scrollBy({
          top: rect.top - viewportTop - headerClearance,
          behavior: "smooth",
        });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      }
    }
  };

  window.requestAnimationFrame(() => {
    window.setTimeout(run, 120);
  });
}

function chainFocusables(form: HTMLFormElement): HTMLElement[] {
  const nodes = form.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
  );
  return Array.from(nodes).filter((el) => {
    if (el instanceof HTMLInputElement && el.readOnly) return false;
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    return true;
  });
}

/**
 * 단일 줄 입력·select에서만 다음 필드로 이동 (textarea는 줄바꿈 유지)
 * enterKeyHint="next" 와 함께 모바일 '다음' 키에 맞춤
 */
export function checkoutInputEnterGoNext(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== "Enter") return;
  const t = e.currentTarget;
  if (t instanceof HTMLTextAreaElement) return;

  const form = t.closest("form");
  if (!form) return;

  const chain = chainFocusables(form);
  const idx = chain.indexOf(t);
  if (idx < 0 || idx >= chain.length - 1) return;

  e.preventDefault();
  const next = chain[idx + 1];
  next.focus();
}

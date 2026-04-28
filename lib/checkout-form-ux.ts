import type { FocusEvent, KeyboardEvent } from "react";

/** 가상 키보드에 가리지 않도록 포커스 필드를 뷰 중앙 근처로 스크롤 */
export function checkoutFieldFocusScroll(e: FocusEvent<HTMLElement>): void {
  const el = e.currentTarget;
  window.requestAnimationFrame(() => {
    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
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
  window.requestAnimationFrame(() => {
    next.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  });
}

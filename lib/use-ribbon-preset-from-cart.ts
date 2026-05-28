"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deriveRibbonPresetFromCartItems } from "@/lib/ribbon-default-by-category";
import type { extractProductCategories } from "@/lib/shop-product-categories";

export type CartItemForRibbonDefault = {
  product?: Parameters<typeof extractProductCategories>[0];
};

/**
 * 장바구니 품목 기준 리본 경조사어 기본값 (정책 B: 사용자가 셀렉트 변경 후 자동 덮어쓰기 안 함)
 */
export function useRibbonPresetFromCart(items: CartItemForRibbonDefault[]) {
  const [ribbonPreset, setRibbonPresetState] = useState("__custom__");
  const [ribbonMessageCustom, setRibbonMessageCustom] = useState("");
  const touchedRef = useRef(false);

  useEffect(() => {
    if (items.length === 0 || touchedRef.current) return;
    const next = deriveRibbonPresetFromCartItems(items);
    setRibbonPresetState(next);
    if (next !== "__custom__") setRibbonMessageCustom("");
  }, [items]);

  const setRibbonPreset = useCallback((value: string) => {
    touchedRef.current = true;
    setRibbonPresetState(value);
  }, []);

  return {
    ribbonPreset,
    setRibbonPreset,
    ribbonMessageCustom,
    setRibbonMessageCustom,
  };
}

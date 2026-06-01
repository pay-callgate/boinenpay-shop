import type { ShopProductCategoryRef } from "@/lib/shop-product-categories";
import { extractProductCategories } from "@/lib/shop-product-categories";
import { DELIVERY_TIME_SLOT_ASAP } from "@/lib/checkout-florist-fields";

type CartLineProduct = {
  product_category_mappings?: { category: ShopProductCategoryRef | null }[] | null;
  categories?: ShopProductCategoryRef[] | null;
};

export type CartLineForPreferredTime = {
  product?: CartLineProduct | null;
};

/**
 * All-or-Nothing: 장바구니 모든 상품의 모든 카테고리가 show_preferred_time === true 일 때만 true.
 * 카테고리 없음·false 섞임·빈 장바구니 → false (희망시간대 숨김).
 */
export function cartShowsPreferredTimeSlot(items: CartLineForPreferredTime[]): boolean {
  if (items.length === 0) return false;

  for (const line of items) {
    const categories = extractProductCategories(line.product ?? undefined);
    if (categories.length === 0) return false;
    for (const cat of categories) {
      if (cat.show_preferred_time !== true) return false;
    }
  }
  return true;
}

/** 희망시간대 UI 숨김 시 DB·배송 메모용 ASAP 문구 */
export function resolveOrderDeliveryTimeSlot(
  showPreferredTimePicker: boolean,
  selectedSlot: string
): string {
  if (!showPreferredTimePicker) return DELIVERY_TIME_SLOT_ASAP;
  const trimmed = selectedSlot.trim();
  return trimmed || DELIVERY_TIME_SLOT_ASAP;
}

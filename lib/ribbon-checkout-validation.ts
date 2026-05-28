import { RIBBON_PRESET_NONE, resolveRibbonPhrase } from "@/lib/checkout-florist-fields";
import {
  deriveRibbonRuleKindFromCartItems,
  type RibbonCategoryRuleKind,
} from "@/lib/ribbon-default-by-category";
import type { extractProductCategories } from "@/lib/shop-product-categories";

export const RIBBON_SECTION_PAY_ALERT = "(4. 리본 카드 메세지 )정보를 입력해주세요";

export type CartItemForRibbonValidation = {
  product?: Parameters<typeof extractProductCategories>[0];
};

function isWreathCartKind(kind: RibbonCategoryRuleKind): boolean {
  return kind === "condolence" || kind === "celebration";
}

/**
 * 결제 전 리본·카드 섹션 검증.
 * - 근조/축하 화환: 보내는 분·경조사어 모두 필요, 직접 입력 시 문구 필수
 * - 꽃다발/꽃바구니 + 직접 입력: 직접 입력란 비어 있어도 통과
 */
export function validateRibbonSectionBeforePayment(input: {
  items: CartItemForRibbonValidation[];
  ribbonPreset: string;
  ribbonSender: string;
  ribbonMessageCustom: string;
}): boolean {
  const cartKind = deriveRibbonRuleKindFromCartItems(input.items);
  const sender = input.ribbonSender.trim();
  const message = resolveRibbonPhrase(input.ribbonPreset, input.ribbonMessageCustom);

  if (isWreathCartKind(cartKind)) {
    if (!sender || !message) return false;
    if (input.ribbonPreset === "__custom__" && !input.ribbonMessageCustom.trim()) {
      return false;
    }
    return true;
  }

  if (cartKind === "bouquet" && input.ribbonPreset === "__custom__") {
    return true;
  }

  if (input.ribbonPreset === RIBBON_PRESET_NONE) {
    return true;
  }

  return true;
}

export function alertRibbonSectionPayValidation(): void {
  if (typeof window !== "undefined") {
    window.alert(RIBBON_SECTION_PAY_ALERT);
  }
}

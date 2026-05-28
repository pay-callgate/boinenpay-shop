import {
  extractProductCategories,
  type ShopProductCategoryRef,
} from "@/lib/shop-product-categories";

export type RibbonCategoryRuleKind = "condolence" | "celebration" | "bouquet" | "none";

const RANK: Record<RibbonCategoryRuleKind, number> = {
  condolence: 4,
  celebration: 3,
  bouquet: 2,
  none: 1,
};

const CONDOLENCE_PRESET = "삼가 故人의 冥福을 빕니다";
const CELEBRATION_PRESET = "축하합니다";
const BOUQUET_PRESET = "__custom__";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function normName(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

/** 근조 화환 */
export function isCondolenceWreathCategory(cat: ShopProductCategoryRef): boolean {
  const name = normName(cat.name);
  const slug = norm(cat.slug);
  if (name.includes("근조화환") || (name.includes("근조") && cat.name.includes("화환"))) {
    return true;
  }
  if (
    slug.includes("geunjo") ||
    slug.includes("condolence") ||
    slug.includes("funeral") ||
    slug.includes("joehwa")
  ) {
    return name.includes("근조") || name.includes("화환") || slug.includes("wreath");
  }
  return false;
}

/** 축하 화환 */
export function isCelebrationWreathCategory(cat: ShopProductCategoryRef): boolean {
  const name = normName(cat.name);
  const slug = norm(cat.slug);
  if (name.includes("축하화환") || (name.includes("축하") && cat.name.includes("화환"))) {
    return true;
  }
  if (slug.includes("chukha") || slug.includes("celebration") || slug.includes("congrat")) {
    return name.includes("축하") || name.includes("화환");
  }
  return false;
}

/** 꽃다발 · 꽃바구니 */
export function isBouquetOrBasketCategory(cat: ShopProductCategoryRef): boolean {
  const name = normName(cat.name);
  const slug = norm(cat.slug);
  if (
    name.includes("꽃다발") ||
    name.includes("꽃바구니") ||
    name.includes("flowerbox") ||
    name.includes("플라워박스")
  ) {
    return true;
  }
  return (
    slug === "bouquet" ||
    slug === "basket" ||
    slug === "flowerbox" ||
    slug.includes("bouquet") ||
    slug.includes("basket")
  );
}

export function categoryRuleKind(cat: ShopProductCategoryRef): RibbonCategoryRuleKind | null {
  if (isCondolenceWreathCategory(cat)) return "condolence";
  if (isCelebrationWreathCategory(cat)) return "celebration";
  if (isBouquetOrBasketCategory(cat)) return "bouquet";
  return null;
}

/** 단일 상품(카테고리 목록)에 대한 규칙 */
export function ribbonRuleKindForProductCategories(
  categories: ShopProductCategoryRef[]
): RibbonCategoryRuleKind {
  if (categories.length === 0) return "none";

  let best: RibbonCategoryRuleKind = "none";
  let matched = false;
  for (const cat of categories) {
    const kind = categoryRuleKind(cat);
    if (!kind) continue;
    matched = true;
    if (RANK[kind] > RANK[best]) best = kind;
  }
  if (!matched) return "none";
  return best;
}

export function presetForRibbonRuleKind(kind: RibbonCategoryRuleKind): string {
  switch (kind) {
    case "condolence":
      return CONDOLENCE_PRESET;
    case "celebration":
      return CELEBRATION_PRESET;
    case "bouquet":
    case "none":
    default:
      return BOUQUET_PRESET;
  }
}

export function deriveRibbonRuleKindFromCartItems(
  items: { product?: Parameters<typeof extractProductCategories>[0] }[]
): RibbonCategoryRuleKind {
  if (items.length === 0) return "none";

  let cartBest: RibbonCategoryRuleKind = "none";
  for (const item of items) {
    const cats = extractProductCategories(item.product);
    const itemKind = ribbonRuleKindForProductCategories(cats);
    if (RANK[itemKind] > RANK[cartBest]) cartBest = itemKind;
  }
  return cartBest;
}

export function deriveRibbonPresetFromCartItems(
  items: { product?: Parameters<typeof extractProductCategories>[0] }[]
): string {
  return presetForRibbonRuleKind(deriveRibbonRuleKindFromCartItems(items));
}

/** 근조·축하 화환 외 — 리본·카드 문구 단일 텍스트박스 UI */
export function isRibbonCombinedMessageUiFromCartItems(
  items: { product?: Parameters<typeof extractProductCategories>[0] }[]
): boolean {
  const kind = deriveRibbonRuleKindFromCartItems(items);
  return kind === "bouquet" || kind === "none";
}

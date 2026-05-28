/** 장바구니·주문서 — 상품에 연결된 카테고리 (product_categories) */

export type ShopProductCategoryRef = {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
};

type ProductWithMappings = {
  categories?: ShopProductCategoryRef[] | null;
  product_category_mappings?:
    | { category: ShopProductCategoryRef | null }[]
    | null;
};

export function extractProductCategories(
  product: ProductWithMappings | null | undefined
): ShopProductCategoryRef[] {
  if (!product) return [];
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    return product.categories;
  }
  const maps = product.product_category_mappings ?? [];
  return maps
    .map((m) => m.category)
    .filter((c): c is ShopProductCategoryRef => c != null && Boolean(c.id));
}

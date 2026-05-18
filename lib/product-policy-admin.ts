export type ProductPolicySource = "category_default" | "template" | "custom";

export function resolvePrimaryCategoryId(
  categoryIds: string[],
  primaryCategoryId: string | null | undefined
): string | null {
  if (categoryIds.length === 0) return null;
  if (categoryIds.length === 1) return categoryIds[0];
  if (primaryCategoryId && categoryIds.includes(primaryCategoryId)) {
    return primaryCategoryId;
  }
  return categoryIds[0];
}

export function buildProductCategoryMappingRows(
  productId: string,
  categoryIds: string[],
  primaryCategoryId: string | null | undefined
) {
  const primary = resolvePrimaryCategoryId(categoryIds, primaryCategoryId);
  return categoryIds.map((category_id) => ({
    product_id: productId,
    category_id,
    is_primary: primary != null && category_id === primary,
  }));
}

export function parsePolicySource(raw: unknown): ProductPolicySource | null {
  if (raw === undefined || raw === null) return null;
  if (raw === "category_default" || raw === "template" || raw === "custom") return raw;
  return null;
}

/** 어드민 API용 custom_policy_data 정규화. 잘못된 타입이면 null. */
export function normalizeCustomPolicyDataPayload(raw: unknown): {
  delivery_info: string;
  refund_policy: string;
  product_notice: string;
} | null {
  if (raw === undefined) return null;
  if (raw === null) {
    return { delivery_info: "", refund_policy: "", product_notice: "" };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  return {
    delivery_info: s("delivery_info"),
    refund_policy: s("refund_policy"),
    product_notice: s("product_notice"),
  };
}

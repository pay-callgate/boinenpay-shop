import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckoutResumeOrderPreview } from "@/lib/viewpay-checkout-context";

type OrderItemPreviewRow = {
  product_name: string | null;
  product: { name: string | null; thumbnail_url: string | null } | null;
};

function normalizeProductJoin(
  raw: OrderItemPreviewRow["product"] | OrderItemPreviewRow["product"][] | null | undefined
): OrderItemPreviewRow["product"] {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function normalizePreviewRow(row: {
  product_name?: string | null;
  product?: OrderItemPreviewRow["product"] | OrderItemPreviewRow["product"][] | null;
}): OrderItemPreviewRow {
  return {
    product_name: row.product_name ?? null,
    product: normalizeProductJoin(row.product),
  };
}

/** "근조바구니(특) 외 1건" 형태 */
export function formatResumeOrderPreviewTitle(
  primaryName: string,
  lineCount: number
): string {
  const name = primaryName.trim() || "주문 상품";
  if (lineCount <= 1) return name;
  return `${name} 외 ${lineCount - 1}건`;
}

function resolveItemDisplayName(row: OrderItemPreviewRow): string {
  const fromItem = row.product_name?.trim();
  if (fromItem) return fromItem;
  return row.product?.name?.trim() || "주문 상품";
}

/**
 * pending 주문 1건의 order_items 미리보기 (checkout-guard용)
 */
export async function fetchCheckoutResumeOrderPreview(
  supabase: SupabaseClient,
  orderId: string
): Promise<CheckoutResumeOrderPreview | null> {
  const { data: items, error } = await supabase
    .from("order_items")
    .select(
      `
      product_name,
      product:products (
        name,
        thumbnail_url
      )
    `
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error || !items?.length) return null;

  const rows = items.map((row) => normalizePreviewRow(row as Parameters<typeof normalizePreviewRow>[0]));
  const lineCount = rows.length;
  const primaryProductName = resolveItemDisplayName(rows[0]);
  const thumbnailUrl = rows[0].product?.thumbnail_url?.trim() || null;

  return {
    primaryProductName,
    thumbnailUrl,
    lineCount,
    displayTitle: formatResumeOrderPreviewTitle(primaryProductName, lineCount),
  };
}

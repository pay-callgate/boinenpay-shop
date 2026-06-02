import type { SupabaseClient } from "@supabase/supabase-js";

/** 비회원 cart 활동 유효 기간 — 쿠키 maxAge와 동일 */
export const GUEST_CART_TTL_MS = 3 * 60 * 60 * 1000;

export function isGuestCartStale(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > GUEST_CART_TTL_MS;
}

/**
 * 3시간 초과 게스트 cart면 cart_items 전량 삭제 후 carts.updated_at 갱신.
 * @returns true if purge ran
 */
export async function purgeStaleGuestCartItems(
  supabase: SupabaseClient,
  cartId: string,
  updatedAt: string
): Promise<boolean> {
  if (!isGuestCartStale(updatedAt)) return false;

  const { error: delErr } = await supabase.from("cart_items").delete().eq("cart_id", cartId);
  if (delErr) {
    console.error("[GuestCart] stale purge delete failed", delErr);
    return false;
  }

  const { error: touchErr } = await supabase
    .from("carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", cartId);

  if (touchErr) {
    console.error("[GuestCart] stale purge touch failed", touchErr);
  }

  return true;
}

export async function touchGuestCartActivity(
  supabase: SupabaseClient,
  cartId: string
): Promise<void> {
  await supabase
    .from("carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", cartId);
}

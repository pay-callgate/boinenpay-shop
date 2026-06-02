import { describe, expect, it } from "vitest";
import { GUEST_CART_TTL_MS, isGuestCartStale } from "./guest-cart-stale";

describe("isGuestCartStale", () => {
  it("3시간 이내면 stale 아님", () => {
    const recent = new Date(Date.now() - GUEST_CART_TTL_MS + 60_000).toISOString();
    expect(isGuestCartStale(recent)).toBe(false);
  });

  it("3시간 초과면 stale", () => {
    const old = new Date(Date.now() - GUEST_CART_TTL_MS - 1000).toISOString();
    expect(isGuestCartStale(old)).toBe(true);
  });

  it("updatedAt 없으면 stale 아님", () => {
    expect(isGuestCartStale(null)).toBe(false);
  });
});

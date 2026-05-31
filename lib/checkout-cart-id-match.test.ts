import { describe, expect, it } from "vitest";
import {
  cartItemIdsEqual,
  hasCheckoutCartMismatch,
  normalizeCartItemIdSet,
} from "./checkout-cart-id-match";

describe("checkout-cart-id-match", () => {
  it("normalizeCartItemIdSet dedupes and sorts", () => {
    expect(normalizeCartItemIdSet(["b", "a", "b"])).toEqual(["a", "b"]);
  });

  it("cartItemIdsEqual ignores order", () => {
    expect(cartItemIdsEqual(["x", "y"], ["y", "x"])).toBe(true);
  });

  it("hasCheckoutCartMismatch when ids differ", () => {
    expect(hasCheckoutCartMismatch(["a"], ["b"])).toBe(true);
  });

  it("hasCheckoutCartMismatch false when order has no snapshot", () => {
    expect(hasCheckoutCartMismatch(["a"], null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { maxCartLineOrderQty } from "./cart-line-quantity";

describe("maxCartLineOrderQty", () => {
  it("품절이면 현재 수량 유지", () => {
    expect(maxCartLineOrderQty({ status: "sold_out", stock_qty: 10 }, 3)).toBe(3);
  });

  it("재고 무제한이면 99999", () => {
    expect(maxCartLineOrderQty({ status: "active", stock_qty: null }, 1)).toBe(99_999);
  });

  it("재고 있으면 stock_qty", () => {
    expect(maxCartLineOrderQty({ status: "active", stock_qty: 5 }, 1)).toBe(5);
  });
});

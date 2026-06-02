import { describe, expect, it } from "vitest";
import { cartOptionsEqual, findMatchingCartItem } from "./cart-item-option-match";

describe("cart-item-option-match", () => {
  it("둘 다 null이면 일치", () => {
    expect(cartOptionsEqual(null, null)).toBe(true);
  });

  it("옵션 JSON 동등", () => {
    expect(cartOptionsEqual({ a: "1" }, { a: "1" })).toBe(true);
    expect(cartOptionsEqual({ a: "1" }, { a: "2" })).toBe(false);
  });

  it("findMatchingCartItem", () => {
    const items = [
      { id: "1", option_json: { color: "red" } },
      { id: "2", option_json: null },
    ];
    expect(findMatchingCartItem(items, null)?.id).toBe("2");
    expect(findMatchingCartItem(items, { color: "red" })?.id).toBe("1");
  });
});

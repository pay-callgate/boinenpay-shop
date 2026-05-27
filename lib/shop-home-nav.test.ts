import { describe, expect, it } from "vitest";
import {
  getShopHomeHref,
  isShopHomePath,
  normalizeShopPathname,
} from "./shop-home-nav";

describe("shop-home-nav", () => {
  it("normalizeShopPathname strips trailing slash", () => {
    expect(normalizeShopPathname("/foo/bar/")).toBe("/foo/bar");
    expect(normalizeShopPathname("/foo")).toBe("/foo");
  });

  it("getShopHomeHref", () => {
    expect(getShopHomeHref("jsb", "acme")).toBe("/jsb/acme");
    expect(getShopHomeHref("jsb", null)).toBe("/jsb");
  });

  it("isShopHomePath for client shop", () => {
    expect(isShopHomePath("/jsb/acme", "jsb", "acme")).toBe(true);
    expect(isShopHomePath("/jsb/acme/", "jsb", "acme")).toBe(true);
    expect(isShopHomePath("/jsb/acme/cart", "jsb", "acme")).toBe(false);
  });

  it("isShopHomePath for partner preview roots", () => {
    expect(isShopHomePath("/jsb", "jsb", null)).toBe(true);
    expect(isShopHomePath("/jsb/_preview", "jsb", null)).toBe(true);
    expect(isShopHomePath("/jsb/acme", "jsb", null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  getClientSlugFromShopPath,
  isCustomerForbiddenMasterTemplatePath,
  resolveShopClientSlug,
  SHOP_MASTER_PREVIEW_SLUG,
} from "./resolve-shop-client-slug";

describe("getClientSlugFromShopPath", () => {
  it("거래처 slug 추출", () => {
    expect(getClientSlugFromShopPath("/wooribugo/wooribu/products", "wooribugo")).toBe(
      "wooribu"
    );
  });

  it("_preview·login 은 제외", () => {
    expect(getClientSlugFromShopPath("/wooribugo/_preview", "wooribugo")).toBeNull();
    expect(getClientSlugFromShopPath("/wooribugo/login", "wooribugo")).toBeNull();
  });
});

describe("resolveShopClientSlug", () => {
  it("callbackUrl 우선", () => {
    expect(
      resolveShopClientSlug({
        subdomain: "wooribugo",
        callbackUrl: "/wooribugo/wooribu/cart",
        queryClientSlug: "other",
      })
    ).toBe("wooribu");
  });
});

describe("isCustomerForbiddenMasterTemplatePath", () => {
  it("파트너 루트·_preview 차단", () => {
    expect(isCustomerForbiddenMasterTemplatePath("/wooribugo", "wooribugo")).toBe(true);
    expect(
      isCustomerForbiddenMasterTemplatePath(`/wooribugo/${SHOP_MASTER_PREVIEW_SLUG}`, "wooribugo")
    ).toBe(true);
    expect(isCustomerForbiddenMasterTemplatePath("/wooribugo/wooribu", "wooribugo")).toBe(
      false
    );
  });
});

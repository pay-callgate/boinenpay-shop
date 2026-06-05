import { describe, expect, it } from "vitest";
import {
  getShopCustomerServiceTel,
  getShopCustomerServiceTelHref,
  SHOP_CS_TEL_DEFAULT,
} from "./shop-customer-service";

describe("shop-customer-service", () => {
  it("기본 고객센터 번호", () => {
    expect(SHOP_CS_TEL_DEFAULT).toBe("1661-5382");
  });

  it("tel href는 숫자만", () => {
    expect(getShopCustomerServiceTelHref()).toBe("tel:16615382");
  });

  it("getShopCustomerServiceTel은 env 미설정 시 기본값", () => {
    expect(getShopCustomerServiceTel()).toBe("1661-5382");
  });
});

import { describe, expect, it } from "vitest";
import {
  resolveShopFulfillmentStage,
  shopOrderCustomerBadge,
  shopOrderProgressStepIndex,
} from "./customer-order-fulfillment";

describe("customer-order-fulfillment", () => {
  it("결제 완료 + 접수 → payment_done 단계", () => {
    expect(resolveShopFulfillmentStage({ status: "received", payment_status: "paid" })).toEqual({
      kind: "stage",
      stage: "payment_done",
    });
    expect(shopOrderProgressStepIndex({ status: "received", payment_status: "paid" })).toBe(0);
    expect(shopOrderCustomerBadge({ status: "received", payment_status: "paid" }).label).toBe("결제 완료");
  });

  it("결제 완료 + 준비중 → crafting", () => {
    expect(resolveShopFulfillmentStage({ status: "preparing", payment_status: "paid" })).toEqual({
      kind: "stage",
      stage: "crafting",
    });
    expect(shopOrderProgressStepIndex({ status: "preparing", payment_status: "paid" })).toBe(1);
    expect(shopOrderCustomerBadge({ status: "preparing", payment_status: "paid" }).label).toBe("화환 제작중");
  });

  it("배송중 → departure", () => {
    expect(shopOrderCustomerBadge({ status: "shipping", payment_status: "paid" }).label).toBe("배송 출발");
    expect(shopOrderProgressStepIndex({ status: "shipping", payment_status: "paid" })).toBe(2);
  });

  it("배송완료 → complete", () => {
    expect(shopOrderCustomerBadge({ status: "delivered", payment_status: "paid" }).label).toBe("배송 완료");
    expect(shopOrderProgressStepIndex({ status: "delivered", payment_status: "paid" })).toBe(3);
  });

  it("미결제 → pending", () => {
    expect(resolveShopFulfillmentStage({ status: "received", payment_status: "pending" })).toEqual({
      kind: "pending",
    });
    expect(shopOrderProgressStepIndex({ status: "received", payment_status: "pending" })).toBe(-1);
  });
});

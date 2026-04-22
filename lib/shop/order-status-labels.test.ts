import { describe, expect, it } from "vitest";
import { shopOrderStatusLabel, shopPaymentStatusLabel } from "@/lib/shop/order-status-labels";

describe("order-status-labels", () => {
  it("shopOrderStatusLabel: 알 수 없는 값은 처리 중", () => {
    expect(shopOrderStatusLabel("confirmed")).toBe("주문 확정");
    expect(shopOrderStatusLabel("unknown_code")).toBe("처리 중");
    expect(shopOrderStatusLabel(null)).toBe("처리 중");
  });

  it("shopPaymentStatusLabel", () => {
    expect(shopPaymentStatusLabel("paid")).toBe("결제 완료");
    expect(shopPaymentStatusLabel("weird")).toBe("처리 중");
  });
});

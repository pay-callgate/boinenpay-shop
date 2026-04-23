import { describe, expect, it } from "vitest";
import { shopOrderDetailBadgeStatus } from "./order-status-labels";

describe("shopOrderDetailBadgeStatus", () => {
  it("결제 대기인데 배송준비중이면 입금 대기 배지로 통일", () => {
    const r = shopOrderDetailBadgeStatus({ status: "preparing", payment_status: "pending" });
    expect(r.statusKey).toBe("pending_payment");
    expect(r.showPaymentBeforeFulfillmentNote).toBe(true);
  });

  it("결제 완료면 주문 status 그대로", () => {
    const r = shopOrderDetailBadgeStatus({ status: "preparing", payment_status: "paid" });
    expect(r.statusKey).toBe("preparing");
    expect(r.showPaymentBeforeFulfillmentNote).toBe(false);
  });

  it("결제 대기 + 접수는 그대로", () => {
    const r = shopOrderDetailBadgeStatus({ status: "received", payment_status: "pending" });
    expect(r.statusKey).toBe("received");
    expect(r.showPaymentBeforeFulfillmentNote).toBe(false);
  });
});

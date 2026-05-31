import { describe, expect, it } from "vitest";
import {
  VIEWPAY_RECENT_PAID_WINDOW_MS,
  buildOrderCompletePath,
  isRecentlyPaidOrder,
} from "./viewpay-sync-status";

describe("viewpay-sync-status helpers", () => {
  it("isRecentlyPaidOrder accepts paid within window", () => {
    const now = Date.now();
    const updated = new Date(now - 5 * 60 * 1000).toISOString();
    expect(
      isRecentlyPaidOrder({ payment_status: "paid", updated_at: updated }, now)
    ).toBe(true);
  });

  it("isRecentlyPaidOrder rejects paid outside window", () => {
    const now = Date.now();
    const updated = new Date(now - VIEWPAY_RECENT_PAID_WINDOW_MS - 1000).toISOString();
    expect(
      isRecentlyPaidOrder({ payment_status: "paid", updated_at: updated }, now)
    ).toBe(false);
  });

  it("isRecentlyPaidOrder rejects non-paid", () => {
    const now = Date.now();
    expect(
      isRecentlyPaidOrder({ payment_status: "pending", updated_at: new Date(now).toISOString() }, now)
    ).toBe(false);
  });

  it("buildOrderCompletePath includes guest auth params", () => {
    const path = buildOrderCompletePath("shop", "florist-a", {
      id: "order-uuid-1",
      is_guest: true,
      guest_checkout_token: "guest-token-abc",
    });
    expect(path).toContain("/shop/florist-a/order/complete?orderId=order-uuid-1");
    expect(path).toContain("guestToken=");
    expect(path).toContain("sig=");
  });

  it("buildOrderCompletePath omits guest params for member orders", () => {
    const path = buildOrderCompletePath("shop", "florist-a", {
      id: "order-uuid-2",
      is_guest: false,
      guest_checkout_token: null,
    });
    expect(path).toBe("/shop/florist-a/order/complete?orderId=order-uuid-2");
  });
});

import { describe, expect, it } from "vitest";
import { resolveCheckoutGuardScenario } from "./viewpay-checkout-guard-logic";
import {
  VIEWPAY_RECENT_PAID_WINDOW_MS,
  VIEWPAY_RECENT_PENDING_WINDOW_MS,
  buildOrderCompletePath,
  isRecentlyPaidOrder,
  isRecentlyPendingOrder,
} from "./viewpay-sync-status";
import { isViewpayGatewayRedirectUrl } from "./viewpay";

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

  it("isRecentlyPendingOrder accepts pending within 30min", () => {
    const now = Date.now();
    const created = new Date(now - 10 * 60 * 1000).toISOString();
    expect(
      isRecentlyPendingOrder({ payment_status: "pending", created_at: created }, now)
    ).toBe(true);
    expect(VIEWPAY_RECENT_PENDING_WINDOW_MS).toBe(VIEWPAY_RECENT_PAID_WINDOW_MS);
  });

  it("isRecentlyPendingOrder rejects pending outside window", () => {
    const now = Date.now();
    const created = new Date(now - VIEWPAY_RECENT_PENDING_WINDOW_MS - 1000).toISOString();
    expect(
      isRecentlyPendingOrder({ payment_status: "pending", created_at: created }, now)
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

describe("resolveCheckoutGuardScenario (7 E2E 시나리오 로직)", () => {
  const now = Date.parse("2026-05-31T12:00:00.000Z");

  it("1) cart有 → guard idle (호출 안 함 — 페이지에서 cartItemCount>0)", () => {
    expect(resolveCheckoutGuardScenario(null, true, now)).toBe("none");
  });

  it("2) cart空 + pending → pending", () => {
    expect(
      resolveCheckoutGuardScenario(
        {
          payment_status: "pending",
          created_at: new Date(now - 5 * 60 * 1000).toISOString(),
        },
        true,
        now
      )
    ).toBe("pending");
  });

  it("3) cart空 + paid → paid", () => {
    expect(
      resolveCheckoutGuardScenario(
        {
          payment_status: "paid",
          updated_at: new Date(now - 5 * 60 * 1000).toISOString(),
        },
        true,
        now
      )
    ).toBe("paid");
  });

  it("4) cart空 + 주문 없음 → none", () => {
    expect(resolveCheckoutGuardScenario(null, true, now)).toBe("none");
  });

  it("5) cancel=1 + pending → pending (skip 없음)", () => {
    expect(
      resolveCheckoutGuardScenario(
        {
          payment_status: "pending",
          created_at: new Date(now - 2 * 60 * 1000).toISOString(),
        },
        true,
        now
      )
    ).toBe("pending");
  });

  it("6) paid 우선 (pending보다 paid)", () => {
    expect(
      resolveCheckoutGuardScenario(
        {
          payment_status: "paid",
          updated_at: new Date(now - 1 * 60 * 1000).toISOString(),
        },
        true,
        now
      )
    ).toBe("paid");
  });

  it("7) no_identity → no_identity", () => {
    expect(resolveCheckoutGuardScenario(null, false, now)).toBe("no_identity");
  });
});

describe("isViewpayGatewayRedirectUrl (Phase B)", () => {
  it("accepts ViewPay landing URL", () => {
    expect(
      isViewpayGatewayRedirectUrl(
        "https://stgvl.boinenpay.com/v1/web/landing?tid=abc&token=xyz"
      )
    ).toBe(true);
  });

  it("rejects merchant order/complete return URL", () => {
    expect(
      isViewpayGatewayRedirectUrl(
        "https://www.calllinkshop.com/wooribugo/wooribu/order/complete?orderId=uuid"
      )
    ).toBe(false);
  });

  it("rejects shop home URL", () => {
    expect(
      isViewpayGatewayRedirectUrl("https://www.calllinkshop.com/wooribugo/wooribu")
    ).toBe(false);
  });
});

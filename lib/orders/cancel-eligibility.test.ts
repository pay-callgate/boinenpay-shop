import { describe, expect, it } from "vitest";
import { canCustomerRequestCancel, canPartnerAdminCancelOrder } from "./cancel-eligibility";

describe("canCustomerRequestCancel", () => {
  it("결제 완료 + 접수 전(null state) → 허용", () => {
    const r = canCustomerRequestCancel({
      payment_status: "paid",
      status: "received",
      newrun_delivery_info: { state: null },
    });
    expect(r).toEqual({ ok: true });
  });

  it("협회 주문접수(state 2) 이후 → 거절", () => {
    const r = canCustomerRequestCancel({
      payment_status: "paid",
      status: "confirmed",
      newrun_delivery_info: { state: "2" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("association_accepted");
  });

  it("미결제 → 거절", () => {
    const r = canCustomerRequestCancel({
      payment_status: "pending",
      status: "received",
      newrun_delivery_info: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_paid");
  });
});

describe("canPartnerAdminCancelOrder", () => {
  it("결제완료·배송완료 전 → 허용", () => {
    const r = canPartnerAdminCancelOrder({
      payment_status: "paid",
      status: "confirmed",
      newrun_delivery_info: { state: "2" },
    });
    expect(r).toEqual({ ok: true });
  });

  it("내부 delivered → 거절", () => {
    const r = canPartnerAdminCancelOrder({
      payment_status: "paid",
      status: "delivered",
      newrun_delivery_info: { state: "3" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("delivered");
  });

  it("뉴런 state 4 → 거절", () => {
    const r = canPartnerAdminCancelOrder({
      payment_status: "paid",
      status: "shipping",
      newrun_delivery_info: { state: "4" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("newrun_delivered");
  });
});

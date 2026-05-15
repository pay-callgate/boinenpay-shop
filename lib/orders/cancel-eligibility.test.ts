import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  it("결제완료·배송준비중 → 허용", () => {
    const r = canPartnerAdminCancelOrder({
      payment_status: "paid",
      status: "preparing",
      newrun_delivery_info: { state: "2" },
    });
    expect(r).toEqual({ ok: true });
  });

  it("결제 직후 received + paid → 허용", () => {
    const r = canPartnerAdminCancelOrder({
      payment_status: "paid",
      status: "received",
      newrun_delivery_info: null,
    });
    expect(r).toEqual({ ok: true });
  });

  it("접수·주문확정 등(결제완료 상태 아님) → 거절", () => {
    const r = canPartnerAdminCancelOrder({
      payment_status: "paid",
      status: "confirmed",
      newrun_delivery_info: { state: "2" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("status_not_eligible");
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

describe("canPartnerAdminCancelOrder (PARTNER_PAYMENT_CANCEL_TEST_BYPASS)", () => {
  beforeEach(() => {
    vi.stubEnv("PARTNER_PAYMENT_CANCEL_TEST_BYPASS", "true");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("테스트 우회 시 미결제·비정상 상태도 허용", () => {
    const r = canPartnerAdminCancelOrder({
      payment_status: "pending",
      status: "confirmed",
      newrun_delivery_info: { state: "4" },
    });
    expect(r).toEqual({ ok: true });
  });
});

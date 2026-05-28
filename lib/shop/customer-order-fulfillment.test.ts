import { describe, expect, it } from "vitest";
import {
  countOrdersByShopFulfillmentStage,
  resolveShopCustomerDisplayStage,
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
    expect(shopOrderCustomerBadge({ status: "preparing", payment_status: "paid" }).label).toBe("상품 준비중");
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

  it("countOrdersByShopFulfillmentStage: 결제 완료만 집계·목록 규칙과 동일", () => {
    const rows = [
      { status: "received", payment_status: "paid" },
      { status: "preparing", payment_status: "paid" },
      { status: "shipping", payment_status: "paid" },
      { status: "delivered", payment_status: "paid" },
      { status: "confirmed_purchase", payment_status: "paid" },
      { status: "received", payment_status: "pending" },
      { status: "cancelled", payment_status: "paid" },
    ];
    expect(countOrdersByShopFulfillmentStage(rows)).toEqual({
      payment_done: 1,
      crafting: 1,
      departure: 1,
      complete: 2,
    });
  });

  it("시뮬레이션: paid_at 기준 1h/5h 경계에서 단계 전환", () => {
    const paidAt = "2026-05-28T03:00:00.000Z"; // KST 12:00
    expect(
      resolveShopCustomerDisplayStage(
        {
          status: "received",
          payment_status: "paid",
          paid_at: paidAt,
        },
        new Date("2026-05-28T03:30:00.000Z")
      )
    ).toEqual({ kind: "stage", stage: "payment_done" });

    expect(
      resolveShopCustomerDisplayStage(
        {
          status: "received",
          payment_status: "paid",
          paid_at: paidAt,
        },
        new Date("2026-05-28T04:00:00.000Z")
      )
    ).toEqual({ kind: "stage", stage: "crafting" });

    expect(
      resolveShopCustomerDisplayStage(
        {
          status: "received",
          payment_status: "paid",
          paid_at: paidAt,
        },
        new Date("2026-05-28T08:00:00.000Z")
      )
    ).toEqual({ kind: "stage", stage: "departure" });
  });

  it("시뮬레이션: 예약 주문은 희망일 21:00 이전 완료로 올리지 않음", () => {
    const paidAt = "2026-05-28T14:00:00.000Z"; // KST 23:00
    expect(
      resolveShopCustomerDisplayStage(
        {
          status: "received",
          payment_status: "paid",
          paid_at: paidAt,
          desired_delivery_date: "2026-05-30",
        },
        new Date("2026-05-29T16:00:00.000Z") // KST 2026-05-30 01:00
      )
    ).toEqual({ kind: "stage", stage: "departure" });
  });

  it("시뮬레이션: 15시간 이상 + max(익일00시, 희망일21시) 경과 시 완료", () => {
    const paidAt = "2026-05-28T03:00:00.000Z"; // KST 12:00
    expect(
      resolveShopCustomerDisplayStage(
        {
          status: "received",
          payment_status: "paid",
          paid_at: paidAt,
          desired_delivery_date: "2026-05-28",
        },
        new Date("2026-05-29T12:00:00.000Z") // KST 21:00
      )
    ).toEqual({ kind: "stage", stage: "complete" });
  });

  it("DB 실제 상태 우선: DB가 shipping이면 시뮬보다 앞선 단계 유지", () => {
    expect(
      resolveShopCustomerDisplayStage(
        {
          status: "shipping",
          payment_status: "paid",
          paid_at: "2026-05-28T03:00:00.000Z",
        },
        new Date("2026-05-28T03:20:00.000Z")
      )
    ).toEqual({ kind: "stage", stage: "departure" });
  });
});

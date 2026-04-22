import { describe, expect, it } from "vitest";
import {
  formatNewrunAssociationStateShort,
  hasNewrunDeliveryCallbackInfo,
  isNewrunCourierReadOnly,
  shouldShowAdminNewrunShippingBadge,
} from "@/lib/newrun/admin-newrun-courier-lock";

describe("admin-newrun-courier-lock", () => {
  it("hasNewrunDeliveryCallbackInfo", () => {
    expect(hasNewrunDeliveryCallbackInfo(null)).toBe(false);
    expect(hasNewrunDeliveryCallbackInfo({ state: "2" })).toBe(true);
    expect(hasNewrunDeliveryCallbackInfo({ lastCallbackAt: "2026-01-01" })).toBe(true);
  });

  it("isNewrunCourierReadOnly", () => {
    expect(isNewrunCourierReadOnly({ newrun_submit_status: "success" })).toBe(true);
    expect(isNewrunCourierReadOnly({ newrun_rwr_orderkey: "K1" })).toBe(true);
    expect(isNewrunCourierReadOnly({ newrun_delivery_info: { state: "3" } })).toBe(true);
    expect(isNewrunCourierReadOnly({ newrun_submit_status: "failed" })).toBe(false);
  });

  it("shouldShowAdminNewrunShippingBadge", () => {
    expect(shouldShowAdminNewrunShippingBadge({ payment_status: "paid", newrun_submit_status: "failed" })).toBe(
      true
    );
    expect(shouldShowAdminNewrunShippingBadge({ payment_status: "pending", newrun_submit_status: "success" })).toBe(
      false
    );
  });

  it("formatNewrunAssociationStateShort", () => {
    expect(formatNewrunAssociationStateShort({ state: "3" })).toBe("배송중");
    expect(formatNewrunAssociationStateShort({})).toBe("—");
  });
});

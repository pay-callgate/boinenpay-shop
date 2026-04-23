import { describe, expect, it } from "vitest";
import {
  formatDesiredDeliveryDateTimeLine,
  isDesiredDeliveryToday,
  toDesiredDeliveryYmd,
} from "./admin-florist-order-display";

describe("admin-florist-order-display", () => {
  it("formatDesiredDeliveryDateTimeLine joins date and slot", () => {
    expect(
      formatDesiredDeliveryDateTimeLine("2026-03-15", "14:00~16:00")
    ).toBe("2026.03.15 · 14:00~16:00");
  });

  it("isDesiredDeliveryToday compares normalized YMD", () => {
    expect(isDesiredDeliveryToday("2026-03-15", "2026-03-15")).toBe(true);
    expect(isDesiredDeliveryToday("2026-03-14", "2026-03-15")).toBe(false);
  });

  it("toDesiredDeliveryYmd keeps DATE string", () => {
    expect(toDesiredDeliveryYmd("2026-03-15")).toBe("2026-03-15");
    expect(toDesiredDeliveryYmd(null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  clampDeliveryDateYmd,
  getSeoulTodayYmd,
  getSeoulTomorrowYmd,
  isDeliveryDateInPast,
} from "./shop-delivery-date";

describe("shop-delivery-date", () => {
  it("getSeoulTomorrowYmd is after today", () => {
    expect(getSeoulTomorrowYmd() > getSeoulTodayYmd()).toBe(true);
  });

  it("isDeliveryDateInPast", () => {
    expect(isDeliveryDateInPast("2000-01-01")).toBe(true);
    expect(isDeliveryDateInPast(getSeoulTomorrowYmd())).toBe(false);
  });

  it("clampDeliveryDateYmd replaces past with today", () => {
    expect(clampDeliveryDateYmd("2000-01-01")).toBe(getSeoulTodayYmd());
    expect(clampDeliveryDateYmd(getSeoulTomorrowYmd())).toBe(getSeoulTomorrowYmd());
  });
});

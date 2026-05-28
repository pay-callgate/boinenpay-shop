import { describe, expect, it } from "vitest";
import {
  RIBBON_PRESET_NONE,
  buildFloristShippingDetailText,
  isRibbonFloristRequired,
  resolveRibbonPhrase,
} from "./checkout-florist-fields";

describe("ribbon florist required", () => {
  it("isRibbonFloristRequired is false only for 필요없음", () => {
    expect(isRibbonFloristRequired(RIBBON_PRESET_NONE)).toBe(false);
    expect(isRibbonFloristRequired("축하합니다")).toBe(true);
    expect(isRibbonFloristRequired("__custom__")).toBe(true);
  });

  it("resolveRibbonPhrase returns empty for 필요없음", () => {
    expect(resolveRibbonPhrase(RIBBON_PRESET_NONE, "ignored")).toBe("");
  });
});

describe("buildFloristShippingDetailText", () => {
  it("omits ribbon lines when sender and message are empty", () => {
    const text = buildFloristShippingDetailText({
      venueDetail: "1층",
      deliveryDate: "2026-05-28",
      deliveryTimeSlot: "14:00~16:00",
      ordererName: "홍길동",
      ordererPhone: "01012345678",
      ribbonSender: "",
      ribbonMessage: "",
    });
    expect(text).not.toContain("[보내는 분");
    expect(text).not.toContain("[리본 문구]");
  });
});

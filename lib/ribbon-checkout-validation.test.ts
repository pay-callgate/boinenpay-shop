import { describe, expect, it } from "vitest";
import { validateRibbonSectionBeforePayment } from "./ribbon-checkout-validation";

describe("validateRibbonSectionBeforePayment", () => {
  const wreathItem = {
    product: {
      product_category_mappings: [
        { category: { id: "1", name: "근조 화환", slug: "a" } },
      ],
    },
  };

  const bouquetItem = {
    product: {
      product_category_mappings: [
        { category: { id: "2", name: "꽃다발", slug: "bouquet" } },
      ],
    },
  };

  it("근조 화환: 보내는 분 또는 경조사어 없으면 실패", () => {
    expect(
      validateRibbonSectionBeforePayment({
        items: [wreathItem],
        ribbonPreset: "삼가 故人의 冥福을 빕니다",
        ribbonSender: "",
        ribbonMessageCustom: "",
      })
    ).toBe(false);
    expect(
      validateRibbonSectionBeforePayment({
        items: [wreathItem],
        ribbonPreset: "__custom__",
        ribbonSender: "홍길동",
        ribbonMessageCustom: "",
      })
    ).toBe(false);
  });

  it("근조 화환: 둘 다 있으면 통과", () => {
    expect(
      validateRibbonSectionBeforePayment({
        items: [wreathItem],
        ribbonPreset: "삼가 故人의 冥福을 빕니다",
        ribbonSender: "홍길동",
        ribbonMessageCustom: "",
      })
    ).toBe(true);
  });

  it("꽃다발 + 직접 입력 빈값: 통과", () => {
    expect(
      validateRibbonSectionBeforePayment({
        items: [bouquetItem],
        ribbonPreset: "__custom__",
        ribbonSender: "",
        ribbonMessageCustom: "",
      })
    ).toBe(true);
  });
});

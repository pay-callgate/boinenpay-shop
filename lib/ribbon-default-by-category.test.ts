import { describe, expect, it } from "vitest";
import {
  deriveRibbonPresetFromCartItems,
  deriveRibbonRuleKindFromCartItems,
  isRibbonCombinedMessageUiFromCartItems,
} from "./ribbon-default-by-category";

describe("deriveRibbonPresetFromCartItems", () => {
  it("카테고리 없음(근조·축하 화환 외) → 직접 입력", () => {
    expect(
      deriveRibbonPresetFromCartItems([
        { product: { product_category_mappings: [] } },
      ])
    ).toBe("__custom__");
  });

  it("근조 화환 → 한자 명복", () => {
    expect(
      deriveRibbonPresetFromCartItems([
        {
          product: {
            product_category_mappings: [
              { category: { id: "1", name: "근조 화환", slug: "geunjo-wreath" } },
            ],
          },
        },
      ])
    ).toBe("삼가 故人의 冥福을 빕니다");
  });

  it("축하 화환 → 축하합니다", () => {
    expect(
      deriveRibbonPresetFromCartItems([
        {
          product: {
            product_category_mappings: [
              { category: { id: "2", name: "축하 화환", slug: "chukha" } },
            ],
          },
        },
      ])
    ).toBe("축하합니다");
  });

  it("꽃다발 → 직접 입력", () => {
    expect(
      deriveRibbonPresetFromCartItems([
        {
          product: {
            product_category_mappings: [
              { category: { id: "3", name: "꽃다발", slug: "bouquet" } },
            ],
          },
        },
      ])
    ).toBe("__custom__");
  });

  it("꽃다발·카테고리 없음 → 통합 리본·카드 UI", () => {
    expect(
      isRibbonCombinedMessageUiFromCartItems([
        {
          product: {
            product_category_mappings: [
              { category: { id: "3", name: "꽃다발", slug: "bouquet" } },
            ],
          },
        },
      ])
    ).toBe(true);
    expect(
      isRibbonCombinedMessageUiFromCartItems([
        {
          product: {
            product_category_mappings: [
              { category: { id: "1", name: "근조 화환", slug: "a" } },
            ],
          },
        },
      ])
    ).toBe(false);
  });

  it("복수 상품: 근조 우선", () => {
    const kind = deriveRibbonRuleKindFromCartItems([
      { product: { product_category_mappings: [] } },
      {
        product: {
          product_category_mappings: [
            { category: { id: "1", name: "축하 화환", slug: "a" } },
          ],
        },
      },
      {
        product: {
          product_category_mappings: [
            { category: { id: "2", name: "근조 화환", slug: "b" } },
          ],
        },
      },
    ]);
    expect(kind).toBe("condolence");
  });
});

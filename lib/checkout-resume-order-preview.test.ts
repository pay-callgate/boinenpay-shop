import { describe, expect, it } from "vitest";
import { formatResumeOrderPreviewTitle } from "./checkout-resume-order-preview";

describe("formatResumeOrderPreviewTitle", () => {
  it("single line — no suffix", () => {
    expect(formatResumeOrderPreviewTitle("근조바구니(특)", 1)).toBe("근조바구니(특)");
  });

  it("two lines — 외 1건", () => {
    expect(formatResumeOrderPreviewTitle("근조바구니(특)", 2)).toBe("근조바구니(특) 외 1건");
  });

  it("three lines — 외 2건", () => {
    expect(formatResumeOrderPreviewTitle("장미 100송이", 3)).toBe("장미 100송이 외 2건");
  });

  it("empty name falls back", () => {
    expect(formatResumeOrderPreviewTitle("", 1)).toBe("주문 상품");
  });
});

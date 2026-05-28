import { describe, expect, it } from "vitest";
import {
  guestOrdererNameMatches,
  normalizeGuestOrderNo,
} from "./guest-order-lookup";

describe("guest-order-lookup", () => {
  it("주문번호 공백·하이픈 제거", () => {
    expect(normalizeGuestOrderNo("ord-20260528-8b10c")).toBe("ORD202605288B10C");
  });

  it("주문자명·수령인명 매칭", () => {
    expect(guestOrdererNameMatches("테스트", "다른이름", "테스트")).toBe(true);
    expect(guestOrdererNameMatches(null, "테스트", "테스트")).toBe(true);
    expect(guestOrdererNameMatches("테스트", "테스트", "다른")).toBe(false);
  });
});

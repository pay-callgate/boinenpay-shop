import { describe, expect, it } from "vitest";
import {
  appendNewrunPoReturnTokenToReturnUrl,
  buildNewrunPoReturnToken,
  isValidNewrunPoReturnToken,
} from "@/lib/newrun/po-return-signing";

describe("po-return-signing", () => {
  it("동일 주문번호·시크릿이면 토큰 검증 통과", () => {
    expect(isValidNewrunPoReturnToken("ORD-1", buildNewrunPoReturnToken("ORD-1", "sec"), "sec")).toBe(
      true
    );
    expect(isValidNewrunPoReturnToken("ORD-1", "wrong", "sec")).toBe(false);
  });

  it("시크릿 미설정이면 토큰 없이도 통과(호환)", () => {
    expect(isValidNewrunPoReturnToken("ORD-1", undefined, undefined)).toBe(true);
  });

  it("appendNewrunPoReturnTokenToReturnUrl — nrpt 쿼리 추가", () => {
    const prev = process.env.NEWRUN_PO_RETURN_SECRET;
    process.env.NEWRUN_PO_RETURN_SECRET = "test-secret";
    try {
      const out = appendNewrunPoReturnTokenToReturnUrl(
        "https://shop.example/foo/newrun/po-return?x=1",
        "NO-99"
      );
      const u = new URL(out);
      expect(u.searchParams.get("x")).toBe("1");
      expect(u.searchParams.get("nrpt")).toBeTruthy();
      expect(
        isValidNewrunPoReturnToken("NO-99", u.searchParams.get("nrpt"), "test-secret")
      ).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.NEWRUN_PO_RETURN_SECRET;
      else process.env.NEWRUN_PO_RETURN_SECRET = prev;
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  alimtalkMessageContainsLocalDevUrl,
  rewriteLocalDevUrlsForAlimtalk,
} from "@/lib/alimtalk-public-url";

describe("alimtalk-public-url", () => {
  it("localhost 감지", () => {
    expect(alimtalkMessageContainsLocalDevUrl("http://localhost:3000/a")).toBe(true);
    expect(alimtalkMessageContainsLocalDevUrl("https://127.0.0.1:3000/a")).toBe(true);
    expect(alimtalkMessageContainsLocalDevUrl("https://www.calllinkshop.com/a")).toBe(false);
  });

  it("origin 만 교체하고 경로 유지", () => {
    expect(
      rewriteLocalDevUrlsForAlimtalk(
        "보기 http://localhost:3000/wooribugo/wooribu 끝",
        "https://abc.ngrok-free.app"
      )
    ).toBe("보기 https://abc.ngrok-free.app/wooribugo/wooribu 끝");
  });
});

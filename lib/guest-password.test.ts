import { describe, expect, it } from "vitest";
import { hashGuestPassword, verifyGuestPassword } from "./guest-password";

describe("guest-password", () => {
  it("해시 후 검증 성공", () => {
    const hash = hashGuestPassword("1234");
    expect(verifyGuestPassword("1234", hash)).toBe(true);
    expect(verifyGuestPassword("9999", hash)).toBe(false);
  });
});

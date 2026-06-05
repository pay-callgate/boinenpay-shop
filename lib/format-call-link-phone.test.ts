import { describe, expect, it } from "vitest";
import { formatCallLinkPhoneDisplay } from "./format-call-link-phone";

describe("formatCallLinkPhoneDisplay", () => {
  it("070 11자리를 3-4-4로 표시", () => {
    expect(formatCallLinkPhoneDisplay("07045044182")).toBe("070-4504-4182");
    expect(formatCallLinkPhoneDisplay("070-4504-4182")).toBe("070-4504-4182");
  });

  it("050 12자리를 4-4-4로 표시", () => {
    expect(formatCallLinkPhoneDisplay("050827935382")).toBe("0508-2793-5382");
    expect(formatCallLinkPhoneDisplay("0508-2793-5382")).toBe("0508-2793-5382");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatAlimtalk070Display,
  getMsgagentTemplateCodeCase1,
  getMsgagentTemplateCodeCase2,
  getMsgagentTemplateCodeForLinkKakao,
  resolveLinkAlimtalkMessage,
} from "./alimtalk-link-template";

describe("formatAlimtalk070Display", () => {
  it("070 11자리를 3-4-4로 표시", () => {
    expect(formatAlimtalk070Display("07045044182")).toBe("070-4504-4182");
    expect(formatAlimtalk070Display("070-4504-4182")).toBe("070-4504-4182");
  });
});

describe("getMsgagentTemplateCodeCase1 / Case2", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("C1 우선, 없으면 레거시 MSGAGENT_TEMPLATE_CODE", () => {
    vi.stubEnv("MSGAGENT_TEMPLATE_CODE_C1", "CLSP00001");
    vi.stubEnv("MSGAGENT_TEMPLATE_CODE", "OLD");
    expect(getMsgagentTemplateCodeCase1()).toBe("CLSP00001");
    vi.unstubAllEnvs();
    vi.stubEnv("MSGAGENT_TEMPLATE_CODE", "LEGACY01");
    expect(getMsgagentTemplateCodeCase1()).toBe("LEGACY01");
  });

  it("C2 환경값, 없으면 기본 CLSP00002", () => {
    vi.stubEnv("MSGAGENT_TEMPLATE_C2", "CLSP00002");
    expect(getMsgagentTemplateCodeCase2()).toBe("CLSP00002");
    vi.unstubAllEnvs();
    expect(getMsgagentTemplateCodeCase2()).toBe("CLSP00002");
  });

  it("getMsgagentTemplateCodeForLinkKakao 분기", () => {
    vi.stubEnv("MSGAGENT_TEMPLATE_CODE_C1", "C1");
    vi.stubEnv("MSGAGENT_TEMPLATE_C2", "C2");
    expect(getMsgagentTemplateCodeForLinkKakao("case1")).toBe("C1");
    expect(getMsgagentTemplateCodeForLinkKakao("case2")).toBe("C2");
  });
});

describe("resolveLinkAlimtalkMessage", () => {
  it("070 미지정 시 Case1(링크만)", () => {
    const m = resolveLinkAlimtalkMessage({
      storeName: "테스트상점",
      orderUrl: "https://example.com/a/b",
    });
    expect(m).toContain("아래의 링크를 눌러");
    expect(m).not.toContain("대표 번호");
    expect(m).toContain("https://example.com/a/b");
    expect(m).toContain("테스트상점");
  });

  it("070 지정 시 Case2", () => {
    const m = resolveLinkAlimtalkMessage({
      storeName: "테스트상점",
      orderUrl: "https://example.com/x",
      callLinkNumFormatted: "070-4504-4182",
    });
    expect(m).toContain("- 대표 번호 : 070-4504-4182");
    expect(m).toContain("- 주문 링크 : https://example.com/x");
    expect(m).toContain("전화번호 또는 링크");
  });
});

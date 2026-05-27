import { describe, expect, it } from "vitest";
import {
  deriveDeliveryOutcome,
  extractReportList,
  parseKakaoReportEntry,
} from "@/lib/msgagent-kakao-report";

describe("parseKakaoReportEntry", () => {
  it("parses reportList item fields", () => {
    const entry = parseKakaoReportEntry({
      cmid: "12345",
      PHONE: "01012345678",
      result: "33",
      resultName: "InvalidPhoneNumberException",
      resendMsgId: "99999",
      resendResult: "0",
      resendResultName: "성공",
    });
    expect(entry.cmid).toBe("12345");
    expect(entry.resultCode).toBe(33);
    expect(entry.resendMsgId).toBe("99999");
    expect(entry.resendResultCode).toBe(0);
  });
});

describe("deriveDeliveryOutcome", () => {
  it("kakao success", () => {
    const kakao = parseKakaoReportEntry({ cmid: "1", result: "0" });
    const out = deriveDeliveryOutcome(kakao, null);
    expect(out.deliveryStatus).toBe("success");
    expect(out.kakaoSuccess).toBe(true);
  });

  it("kakao phone error", () => {
    const kakao = parseKakaoReportEntry({
      cmid: "1",
      result: "33",
      resultName: "InvalidPhoneNumberException",
    });
    const out = deriveDeliveryOutcome(kakao, null);
    expect(out.deliveryStatus).toBe("failed");
    expect(out.kakaoCode).toBe("33");
  });

  it("kakao fail + LMS success via general report", () => {
    const kakao = parseKakaoReportEntry({
      cmid: "1",
      result: "29",
      resendMsgId: "2",
    });
    const sms = parseKakaoReportEntry({ cmid: "2", result: "0" });
    const out = deriveDeliveryOutcome(kakao, sms);
    expect(out.deliveryStatus).toBe("partial");
    expect(out.smsSuccess).toBe(true);
  });

  it("kakao fail + LMS fail", () => {
    const kakao = parseKakaoReportEntry({
      cmid: "1",
      result: "29",
      resendMsgId: "2",
    });
    const sms = parseKakaoReportEntry({ cmid: "2", result: "999" });
    const out = deriveDeliveryOutcome(kakao, sms);
    expect(out.deliveryStatus).toBe("failed");
    expect(out.finalErrorMessage).toContain("카카오");
    expect(out.finalErrorMessage).toContain("대체");
  });

  it("kakao fail + inline resend success", () => {
    const kakao = parseKakaoReportEntry({
      cmid: "1",
      result: "29",
      resendMsgId: "2",
      resendResult: "0",
    });
    const out = deriveDeliveryOutcome(kakao, null);
    expect(out.deliveryStatus).toBe("partial");
    expect(out.smsSuccess).toBe(true);
  });
});

describe("extractReportList", () => {
  it("reads reportList array", () => {
    const list = extractReportList({
      result_code: "0",
      reportList: [{ cmid: "a", result: "0" }],
    });
    expect(list).toHaveLength(1);
    expect(list[0].cmid).toBe("a");
  });
});

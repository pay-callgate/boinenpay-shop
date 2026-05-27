import { describe, expect, it } from "vitest";
import { channelCountsFromLinkKakaoRow } from "@/lib/link-kakao-channel-stats";

describe("channelCountsFromLinkKakaoRow", () => {
  it("kakao success only", () => {
    const c = channelCountsFromLinkKakaoRow({
      provider_ok: true,
      delivery_status: "success",
      kakao_report_code: "0",
    });
    expect(c).toEqual({
      kakaoSuccess: 1,
      kakaoFail: 0,
      smsSuccess: 0,
      smsFail: 0,
    });
  });

  it("kakao 33 + LMS 999 (vendor failure case)", () => {
    const c = channelCountsFromLinkKakaoRow({
      provider_ok: true,
      delivery_status: "failed",
      kakao_report_code: "33",
      sms_report_code: "999",
    });
    expect(c.kakaoFail).toBe(1);
    expect(c.smsFail).toBe(1);
  });

  it("partial: kakao fail + sms success", () => {
    const c = channelCountsFromLinkKakaoRow({
      provider_ok: true,
      delivery_status: "partial",
      kakao_report_code: "29",
      sms_report_code: "0",
    });
    expect(c.kakaoFail).toBe(1);
    expect(c.smsSuccess).toBe(1);
  });
});

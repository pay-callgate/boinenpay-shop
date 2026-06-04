import { describe, expect, it } from "vitest";
import {
  RIBBON_PRESET_NONE,
  buildFloristShippingDetailText,
  formatPhysicalShippingAddressForDisplay,
  formatPhysicalShippingAddressWithPostcode,
  isRibbonFloristRequired,
  resolveRibbonPhrase,
  sanitizeShippingAddressForStorage,
  splitPollutedFloristShippingAddress,
  stripFloristInlineMeta,
} from "./checkout-florist-fields";

describe("ribbon florist required", () => {
  it("isRibbonFloristRequired is false only for 필요없음", () => {
    expect(isRibbonFloristRequired(RIBBON_PRESET_NONE)).toBe(false);
    expect(isRibbonFloristRequired("축하합니다")).toBe(true);
    expect(isRibbonFloristRequired("__custom__")).toBe(true);
  });

  it("resolveRibbonPhrase returns empty for 필요없음", () => {
    expect(resolveRibbonPhrase(RIBBON_PRESET_NONE, "ignored")).toBe("");
  });
});

describe("buildFloristShippingDetailText", () => {
  it("omits ribbon lines when sender and message are empty", () => {
    const text = buildFloristShippingDetailText({
      venueDetail: "1층",
      deliveryDate: "2026-05-28",
      deliveryTimeSlot: "14:00~16:00",
      ordererName: "홍길동",
      ordererPhone: "01012345678",
      ribbonSender: "",
      ribbonMessage: "",
    });
    expect(text).not.toContain("[보내는 분");
    expect(text).not.toContain("[리본 문구]");
  });
});

describe("stripFloristInlineMeta", () => {
  it("한 줄에 붙은 메타 태그를 제거한다 (ORD202606015FF92 패턴)", () => {
    const raw =
      "서울 서초구 서초대로 335 [배달 희망] 2026-06-02 14:00~16:00 [주문자] 테스트 / 01014702580 [보내는 분(리본)] 주식회사 [리본 문구] 삼가 故人의 冥福을 빕니다";
    expect(stripFloristInlineMeta(raw)).toBe("서울 서초구 서초대로 335");
  });

  it("끝의 em dash·-- placeholder 를 제거한다", () => {
    expect(stripFloristInlineMeta("경기 성남시 분당구 판교역로10번길 3-1 —")).toBe(
      "경기 성남시 분당구 판교역로10번길 3-1"
    );
    expect(stripFloristInlineMeta("--")).toBe("");
  });
});

describe("formatPhysicalShippingAddressForDisplay", () => {
  it("shipping_detail 메타 블록(줄바꿈)은 제외하고 장소만 남긴다", () => {
    const display = formatPhysicalShippingAddressForDisplay(
      "서울 서초구 서초대로 335",
      "1층 로비\n\n[배달 희망] 2026-06-02\n[주문자] 테스트"
    );
    expect(display).toBe("서울 서초구 서초대로 335 1층 로비");
    expect(display).not.toContain("[배달");
  });

  it("우편번호 포함 표시", () => {
    expect(
      formatPhysicalShippingAddressWithPostcode(
        "06607",
        "서울 서초구 서초대로 335 [배달 희망] 2026-06-02",
        null
      )
    ).toBe("[06607] 서울 서초구 서초대로 335");
  });
});

describe("sanitizeShippingAddressForStorage", () => {
  it("저장 시 shipping_address 에서 인라인 메타를 제거한다", () => {
    expect(
      sanitizeShippingAddressForStorage(
        "서울 은평구 북한산로 216 [배달 희망] 2026-05-30 [주문자] 테스트"
      )
    ).toBe("서울 은평구 북한산로 216");
  });
});

describe("splitPollutedFloristShippingAddress", () => {
  it("물리 주소와 메타 블록을 분리한다", () => {
    const { physicalAddress, extractedMeta } = splitPollutedFloristShippingAddress(
      "서울 서초구 서초대로 335 [배달 희망] 2026-06-02 [주문자] 홍길동 / 01012345678"
    );
    expect(physicalAddress).toBe("서울 서초구 서초대로 335");
    expect(extractedMeta).toContain("[배달 희망]");
    expect(extractedMeta).toContain("\n[주문자]");
  });
});

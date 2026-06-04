import { describe, expect, it } from "vitest";
import { buildKakaoMapSearchHref, buildKakaoMapSearchQuery } from "./kakao-map-search-url";

describe("buildKakaoMapSearchQuery", () => {
  it("우편번호·장소 안내 문구를 검색어에서 제외한다", () => {
    const q = buildKakaoMapSearchQuery({
      postcode: "06627",
      address: "서울 서초구 효령로77길 28",
      addressDetail: "예: 청첩장 전달\n\n[배달 희망] 2026-06-02",
    });
    expect(q).toBe("서울 서초구 효령로 77길 28");
    expect(q).not.toContain("[배달");
    expect(q).not.toContain("06627");
  });

  it("shipping_address에 붙은 화훼 메타 접미사를 제거한다", () => {
    const q = buildKakaoMapSearchQuery({
      postcode: "06627",
      address: "서울 서초구 효령로77길 28 — [배달 희망] 2026-06-02",
      addressDetail: null,
    });
    expect(q).toBe("서울 서초구 효령로 77길 28");
  });

  it("판교 주소·placeholder -- 를 정리한다", () => {
    const q = buildKakaoMapSearchQuery({
      postcode: "13536",
      address: "경기 성남시 분당구 판교역로10번길 3-1",
      addressDetail: "--",
    });
    expect(q).toBe("경기 성남시 분당구 판교역로 10번길 3-1");
  });
});

describe("buildKakaoMapSearchHref", () => {
  it("map.kakao.com query URL을 생성한다", () => {
    const href = buildKakaoMapSearchHref("서울 서초구 효령로 77길 28");
    expect(href).toMatch(/^https:\/\/map\.kakao\.com\/\?q=/);
    expect(href).toContain(encodeURIComponent("서울 서초구 효령로 77길 28"));
  });
});

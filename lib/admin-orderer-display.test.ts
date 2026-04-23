import { describe, expect, it } from "vitest";
import { formatAdminOrdererDetailLine, formatAdminOrdererListLabel } from "@/lib/admin-orderer-display";

describe("admin-orderer-display", () => {
  it("목록: 비회원이면 비회원 라벨", () => {
    expect(formatAdminOrdererListLabel({ user: null, is_guest: true })).toBe("비회원");
  });

  it("목록: 주문자 이름 컬럼 우선", () => {
    expect(formatAdminOrdererListLabel({ user: null, is_guest: true, orderer_name: "홍길동" })).toBe("홍길동");
  });

  it("상세: 비회원은 연락처 안내", () => {
    expect(formatAdminOrdererDetailLine({ user: null, is_guest: true, shipping_phone: "010-1234" })).toBe(
      "비회원 (연락처 010-1234 · 회원 계정 없음)"
    );
  });

  it("상세: 비회원 주문자 이름·이메일", () => {
    expect(
      formatAdminOrdererDetailLine({
        user: null,
        is_guest: true,
        orderer_name: "김주문",
        guest_orderer_email: "a@b.c",
        shipping_phone: "010",
      })
    ).toBe("비회원 · 김주문 · a@b.c (연락처 010)");
  });

  it("회원은 이름·이메일", () => {
    expect(
      formatAdminOrdererDetailLine({
        user: { name: "Kim", email: "a@b.c" },
        is_guest: false,
      })
    ).toBe("Kim (a@b.c)");
  });
});

import { describe, expect, it } from "vitest";
import {
  formatAdminNewrunSubmitLabel,
  truncateNewrunOrderKey,
} from "@/lib/newrun/admin-order-newrun-summary";

describe("admin-order-newrun-summary", () => {
  it("결제 전은 대시", () => {
    expect(
      formatAdminNewrunSubmitLabel({ payment_status: "pending", newrun_submit_status: null })
    ).toBe("—");
  });

  it("결제완료·미기록 → 미전송", () => {
    expect(formatAdminNewrunSubmitLabel({ payment_status: "paid", newrun_submit_status: null })).toBe(
      "미전송"
    );
  });

  it("성공·실패·스킵", () => {
    expect(
      formatAdminNewrunSubmitLabel({ payment_status: "paid", newrun_submit_status: "success" })
    ).toBe("전송완료");
    expect(
      formatAdminNewrunSubmitLabel({
        payment_status: "paid",
        newrun_submit_status: "failed",
        newrun_rwr_result: "99",
      })
    ).toBe("실패(99)");
    expect(
      formatAdminNewrunSubmitLabel({ payment_status: "paid", newrun_submit_status: "skipped" })
    ).toBe("확인필요");
  });

  it("truncateNewrunOrderKey", () => {
    expect(truncateNewrunOrderKey("AB", 12)).toBe("AB");
    expect(truncateNewrunOrderKey("VERYLONGKEY123", 4)).toBe("VERY…");
  });
});

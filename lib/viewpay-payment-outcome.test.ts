import { describe, expect, it } from "vitest";
import {
  classifyViewpayPaymentFailure,
  hasViewpayApprovalTrace,
} from "./viewpay-payment-outcome";

describe("viewpay-payment-outcome", () => {
  it("7001 without approval trace → user_cancel", () => {
    const info = {
      response: { data: { paymentStatus: "7001", amount: 0 } },
    };
    const r = classifyViewpayPaymentFailure({
      paymentInfo: info,
      message: "결제가 완료되지 않았습니다. (상태: 7001)",
    });
    expect(r.outcome).toBe("user_cancel");
    expect(r.code).toBe("7001");
  });

  it("7001 with approval number → system_error (conservative)", () => {
    const info = {
      response: {
        data: { paymentStatus: "7001", approvalNo: "12345678", amount: 0 },
      },
    };
    expect(hasViewpayApprovalTrace(info)).toBe(true);
    const r = classifyViewpayPaymentFailure({
      paymentInfo: info,
      message: "결제가 완료되지 않았습니다. (상태: 7001)",
    });
    expect(r.outcome).toBe("system_error");
  });

  it("7001 with positive amount → system_error", () => {
    const info = {
      response: { data: { paymentStatus: "7001", amount: 50000 } },
    };
    const r = classifyViewpayPaymentFailure({
      paymentInfo: info,
      message: "결제가 완료되지 않았습니다. (상태: 7001)",
    });
    expect(r.outcome).toBe("system_error");
  });

  it("cancel message without approval → user_cancel", () => {
    const r = classifyViewpayPaymentFailure({
      message: "사용자 취소되었습니다.",
    });
    expect(r.outcome).toBe("user_cancel");
  });

  it("500 httpStatus → system_error", () => {
    const r = classifyViewpayPaymentFailure({
      message: "서버 오류",
      httpStatus: 500,
    });
    expect(r.outcome).toBe("system_error");
    expect(r.code).toBe("500");
  });

  it("generic failure without cancel signals → system_error", () => {
    const r = classifyViewpayPaymentFailure({
      paymentInfo: { response: { data: { paymentStatus: "9999" } } },
      message: "결제가 완료되지 않았습니다. (상태: 9999)",
    });
    expect(r.outcome).toBe("system_error");
  });
});

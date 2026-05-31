import { describe, expect, it } from "vitest";
import {
  amountsMatchViewpayOrder,
  extractOrderIdFromViewpayPayload,
  readStoreOrderStatusFromViewpayInfo,
  verifyViewpayPaymentAgainstOrder,
} from "./viewpay-order-completion";

describe("viewpay-payment-sync verification", () => {
  it("accepts STORE_EVENT_SUCCESS with matching amount", () => {
    const info = {
      response: {
        data: {
          paymentStatus: "PG_MODULE_SUCCESS",
          orderStatus: "STORE_EVENT_SUCCESS",
          amount: 200,
          metaData: JSON.stringify({ o: "order-uuid-1" }),
        },
      },
    };
    expect(readStoreOrderStatusFromViewpayInfo(info)).toBe("STORE_EVENT_SUCCESS");
    expect(verifyViewpayPaymentAgainstOrder(info, 200).ok).toBe(true);
  });

  it("rejects amount mismatch", () => {
    const info = {
      response: {
        data: {
          paymentStatus: "0000",
          orderStatus: "STORE_EVENT_SUCCESS",
          amount: 300,
        },
      },
    };
    const result = verifyViewpayPaymentAgainstOrder(info, 200);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("금액");
    }
  });

  it("parses orderId from metaData", () => {
    const info = {
      metaData: JSON.stringify({ o: "33e9bfd9-cef5-409c-b02b-b8d27fd156c5" }),
    };
    expect(extractOrderIdFromViewpayPayload(info)).toBe(
      "33e9bfd9-cef5-409c-b02b-b8d27fd156c5"
    );
  });

  it("matches amounts within one cent", () => {
    expect(amountsMatchViewpayOrder(200, 200)).toBe(true);
    expect(amountsMatchViewpayOrder(200, 199.999)).toBe(true);
    expect(amountsMatchViewpayOrder(200, 201)).toBe(false);
  });
});

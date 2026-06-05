import { describe, expect, it } from "vitest";
import { buildStartpayBody } from "./viewpay";

const baseParams = {
  orderId: "order-1",
  orderNo: "ORD-001",
  amount: 50000,
  returnUrl: "https://shop.example.com/order/complete",
  buyerName: "홍길동",
  buyerPhone: "01012345678",
  merchantOrderNo: "ORD-001_12345678",
};

describe("buildStartpayBody", () => {
  it("omits customer.buyrMail when buyerEmail is empty", () => {
    const body = buildStartpayBody({ ...baseParams, buyerEmail: "" });
    const customer = body.customer as Record<string, unknown>;
    expect(customer).not.toHaveProperty("buyrMail");
    expect(customer.buyrName).toBe("홍길동");
    expect(customer.buyrTel).toBe("01012345678");
  });

  it("omits customer.buyrMail when buyerEmail is whitespace only", () => {
    const body = buildStartpayBody({ ...baseParams, buyerEmail: "   " });
    const customer = body.customer as Record<string, unknown>;
    expect(customer).not.toHaveProperty("buyrMail");
  });

  it("includes customer.buyrMail when buyerEmail is provided", () => {
    const body = buildStartpayBody({
      ...baseParams,
      buyerEmail: " buyer@example.com ",
    });
    const customer = body.customer as Record<string, unknown>;
    expect(customer.buyrMail).toBe("buyer@example.com");
  });
});

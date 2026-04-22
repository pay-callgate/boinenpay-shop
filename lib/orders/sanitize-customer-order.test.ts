import { describe, expect, it } from "vitest";
import {
  extractPublicDeliveryPhotoUrl,
  sanitizeOrderRowForCustomer,
} from "@/lib/orders/sanitize-customer-order";

describe("sanitize-customer-order", () => {
  it("extractPublicDeliveryPhotoUrl: http(s)만", () => {
    expect(extractPublicDeliveryPhotoUrl(null)).toBeNull();
    expect(extractPublicDeliveryPhotoUrl({ dica: "javascript:alert(1)" })).toBeNull();
    expect(
      extractPublicDeliveryPhotoUrl({ dica: "https://cdn.example.com/ship.jpg?x=1" })
    ).toBe("https://cdn.example.com/ship.jpg?x=1");
  });

  it("sanitize: newrun_delivery_info 제거 + delivery_photo_url만", () => {
    const row = {
      id: "u1",
      order_no: "O1",
      newrun_delivery_info: { dica: "https://x/y.png", state: "4", insuname: "secret" },
    } as Record<string, unknown>;
    const out = sanitizeOrderRowForCustomer(row);
    expect(out.newrun_delivery_info).toBeUndefined();
    expect(out.delivery_photo_url).toBe("https://x/y.png");
    expect(out).not.toHaveProperty("insuname");
  });
});

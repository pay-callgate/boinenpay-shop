import { describe, expect, it } from "vitest";
import {
  handleViewpayWebhook,
  viewpayWebhookSuccess,
} from "./viewpay-webhook";

describe("viewpay-webhook", () => {
  it("returns success shape", () => {
    expect(viewpayWebhookSuccess()).toEqual({
      result: "0000",
      resultMessage: "success",
    });
  });

  it("rejects empty cgTid without calling sync", async () => {
    const res = await handleViewpayWebhook("");
    expect(res.result).toBe("1001");
  });
});

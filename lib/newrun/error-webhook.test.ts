import { afterEach, describe, expect, it, vi } from "vitest";
import { fireNewrunErrorWebhook } from "@/lib/newrun/error-webhook";

describe("fireNewrunErrorWebhook", () => {
  const prev = process.env.NEWRUN_ERROR_WEBHOOK_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEWRUN_ERROR_WEBHOOK_URL;
    else process.env.NEWRUN_ERROR_WEBHOOK_URL = prev;
    vi.unstubAllGlobals();
  });

  it("URL 없으면 fetch 호출 안 함", () => {
    delete process.env.NEWRUN_ERROR_WEBHOOK_URL;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    fireNewrunErrorWebhook({
      order_no: "O1",
      error_code: "X",
      error_message: "m",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("URL 있으면 POST JSON", async () => {
    process.env.NEWRUN_ERROR_WEBHOOK_URL = "https://hooks.example.com/n8n";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    fireNewrunErrorWebhook({
      order_no: "ORD1",
      error_code: "11",
      error_message: "fail",
      timestamp: "2026-03-31T12:00:00.000Z",
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchSpy).toHaveBeenCalled();
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://hooks.example.com/n8n");
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      order_no: "ORD1",
      error_code: "11",
      error_message: "fail",
    });
    fetchSpy.mockRestore();
  });
});

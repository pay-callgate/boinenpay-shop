import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildIntegrationIntranetPostSampleFields } from "@/lib/newrun/integration-intranet-post-sample";

describe("integration-intranet-post-sample", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of [
      "NEWRUN_ROSEWEB_ID",
      "NEWRUN_ROSEWEB_PW",
      "NEWRUN_RW_RETURNURL",
      "NEWRUN_ASSOC_CODE",
      "NEWRUN_INTEGRATION_TEST_SUJUID",
    ] as const) {
      saved[k] = process.env[k];
    }
    process.env.NEWRUN_ROSEWEB_ID = "rose";
    process.env.NEWRUN_ROSEWEB_PW = "secret";
    process.env.NEWRUN_RW_RETURNURL = "https://example.com/po-return";
    process.env.NEWRUN_ASSOC_CODE = "assoc001";
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("샘플 필드에 head·rw_menucode·rw_sujuid·주문번호가 채어진다", () => {
    process.env.NEWRUN_INTEGRATION_TEST_SUJUID = "kot4545";
    const { fields } = buildIntegrationIntranetPostSampleFields();
    expect(fields.rw_type).toBe("head");
    expect(fields.rw_menucode).toBe("35");
    expect(fields.rw_sujuid).toBe("kot4545");
    expect(fields.rw_sno).toBe("00000000-0000-4000-8000-00000000ab7e");
    expect(fields.rw_aname).toContain("발주연동");
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildIntegrationIntranetPostSampleFields,
  INTEGRATION_INTRANET_POST_DEFAULT_SUJUID,
  INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS,
} from "@/lib/newrun/integration-intranet-post-sample";

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

  it("샘플 Payload 인증·수주 ID 는 env 와 무관하게 고정된다", () => {
    process.env.NEWRUN_INTEGRATION_TEST_SUJUID = "custom-sid";
    const { fields } = buildIntegrationIntranetPostSampleFields();
    expect(fields.rw_type).toBe("head");
    expect(fields.rw_menucode).toBe("09");
    expect(fields.rw_rosewebid).toBe(INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS.rw_rosewebid);
    expect(fields.rw_rosewebpw).toBe(INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS.rw_rosewebpw);
    expect(fields.rw_assoc).toBe(INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS.rw_assoc);
    expect(fields.rw_associd).toBe(INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS.rw_associd);
    expect(fields.rw_sujuid).toBe(INTEGRATION_INTRANET_POST_DEFAULT_SUJUID);
    expect(fields.rw_sno).toBe("00000000-0000-4000-8000-00000000ab7e");
    expect(fields.rw_aname).toContain("발주연동");
  });
});

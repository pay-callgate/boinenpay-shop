import { describe, expect, it } from "vitest";
import { resolveCall070QueueKind } from "./call-070-queue-kind";

describe("resolveCall070QueueKind", () => {
  it("isUpdate true면 update", () => {
    expect(
      resolveCall070QueueKind({
        isUpdateRequested: true,
        callcloudRegistered: false,
        call070Connected: false,
      })
    ).toBe("update");
  });

  it("연동 완료 DB 상태면 update", () => {
    expect(
      resolveCall070QueueKind({
        isUpdateRequested: false,
        callcloudRegistered: true,
        call070Connected: true,
      })
    ).toBe("update");
  });

  it("미연동이면 new", () => {
    expect(
      resolveCall070QueueKind({
        isUpdateRequested: false,
        callcloudRegistered: false,
        call070Connected: false,
      })
    ).toBe("new");
  });
});

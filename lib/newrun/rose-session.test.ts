import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { buildRoseSession } from "@/lib/newrun/rose-session";

describe("buildRoseSession (PHP time/md5/base64 대응)", () => {
  it("초 단위 타임스탬프 문자열·md5·ID base64를 DiV로 연결", () => {
    const nowSec = 1700000000;
    const id = "call0000";
    const timeStr = String(nowSec);
    const expected =
      `${Buffer.from(timeStr, "utf8").toString("base64")}DiV` +
      `${createHash("md5").update(timeStr, "utf8").digest("hex")}DiV` +
      `${Buffer.from(id, "utf8").toString("base64")}`;

    expect(buildRoseSession(id, { nowSec })).toBe(expected);
  });

  it("기본값은 Math.floor(Date.now()/1000)에 해당하는 구조를 만든다", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const s = buildRoseSession("u", { nowSec });
    const [b64Time, md5hex, b64Id] = s.split("DiV");
    expect(Buffer.from(b64Time, "base64").toString("utf8")).toBe(String(nowSec));
    expect(md5hex).toHaveLength(32);
    expect(Buffer.from(b64Id, "base64").toString("utf8")).toBe("u");
  });

  it("빈 ID면 오류", () => {
    expect(() => buildRoseSession("  ")).toThrow(/empty/);
  });
});

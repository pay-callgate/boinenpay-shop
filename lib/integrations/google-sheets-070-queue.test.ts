import { describe, expect, it } from "vitest";
import {
  build070QueueRowValues,
  normalizeSpreadsheetId,
} from "./google-sheets-070-queue";

describe("build070QueueRowValues", () => {
  const base = {
    requestedAtKst: "2026-06-05 10:00:00",
    clientId: "client-1",
    clientName: "테스트거래처",
    call070Number: "07012345678",
    greetingMessage: "안녕",
    industry: "화훼",
    adminName: "홍길동",
    adminEmail: "a@b.com",
    adminPhone: "010",
    serviceUrl: "https://example.com",
    smsTextTemplate: "SMS",
  };

  it("신규 연동 행", () => {
    const row = build070QueueRowValues({ ...base, requestKind: "new" });
    expect(row[0]).toBe("2026-06-05 10:00:00");
    expect(row[2]).toBe("테스트거래처");
    expect(row[13]).toBe("연동 대기");
  });

  it("정보 변경 행", () => {
    const row = build070QueueRowValues({ ...base, requestKind: "update" });
    expect(row[0]).toContain("[정보변경]");
    expect(row[2]).toBe("[변경] 테스트거래처");
    expect(row[13]).toBe("변경 요청");
  });
});

describe("normalizeSpreadsheetId", () => {
  const id = "1ufmiKFc9E0fKHN0UNHfxxhCrQGPRoBSf14RcFFzExQo";

  it("순수 ID는 그대로", () => {
    expect(normalizeSpreadsheetId(id)).toBe(id);
  });

  it("전체 URL에서 /d/ 이후 ID만", () => {
    expect(
      normalizeSpreadsheetId(
        `https://docs.google.com/spreadsheets/d/${id}/edit?gid=0#gid=0`
      )
    ).toBe(id);
  });

  it("ID + /edit?gid=0 형태", () => {
    expect(normalizeSpreadsheetId(`${id}/edit?gid=0`)).toBe(id);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeSpreadsheetId } from "./google-sheets-070-queue";

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

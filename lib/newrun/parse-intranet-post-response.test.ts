import { describe, expect, it } from "vitest";
import { parseIntranetPostResponse } from "@/lib/newrun/parse-intranet-post-response";

describe("parseIntranetPostResponse", () => {
  it("쿼리스트링·평문 본문에서 rwr_result 추출", () => {
    expect(
      parseIntranetPostResponse({
        status: 200,
        bodyText: "ok&rwr_result=0&rwr_orderkey=ABC123",
        locationHeader: null,
      })
    ).toEqual({ rwr_result: "0", rwr_orderkey: "ABC123" });
  });

  it("Location 리다이렉트 URL에서만 추출", () => {
    expect(
      parseIntranetPostResponse({
        status: 302,
        bodyText: "<html></html>",
        locationHeader: "https://shop.example/po-return?rwr_result=20&rwr_orderkey=DUPE",
      })
    ).toEqual({ rwr_result: "20", rwr_orderkey: "DUPE" });
  });

  it("본문 우선, 없으면 Location", () => {
    expect(
      parseIntranetPostResponse({
        status: 302,
        bodyText: "rwr_result=0",
        locationHeader: "https://x/?rwr_result=99",
      })
    ).toEqual({ rwr_result: "0", rwr_orderkey: undefined });
  });

  it("HTML hidden input (name→value 순)", () => {
    const html = `<form><input type="hidden" name="rwr_result" value="0" />
      <input type="hidden" name="rwr_orderkey" value="KEY%2F1" /></form>`;
    expect(
      parseIntranetPostResponse({ status: 200, bodyText: html, locationHeader: null })
    ).toEqual({ rwr_result: "0", rwr_orderkey: "KEY/1" });
  });

  it("HTML hidden input (value→name 순)", () => {
    const html = `<input value="11" name="rwr_result" />`;
    expect(
      parseIntranetPostResponse({ status: 200, bodyText: html, locationHeader: null }).rwr_result
    ).toBe("11");
  });

  it("JSON 조각", () => {
    const body = `callback({"rwr_result":"0","rwr_orderkey":"ORD-가"})`;
    expect(
      parseIntranetPostResponse({ status: 200, bodyText: body, locationHeader: null })
    ).toEqual({ rwr_result: "0", rwr_orderkey: "ORD-가" });
  });

  it("rwr_orderkey 퍼센트 인코딩 디코드", () => {
    expect(
      parseIntranetPostResponse({
        status: 200,
        bodyText: "rwr_result=0&rwr_orderkey=%ED%95%9C%EA%B8%80",
        locationHeader: null,
      }).rwr_orderkey
    ).toBe("한글");
  });
});

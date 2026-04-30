import { describe, expect, it } from "vitest";
import {
  buildIntranetPostReturnSnapshot,
  parseIntranetPostResponse,
  type IntranetPostReturnFields,
} from "@/lib/newrun/parse-intranet-post-response";

function rf(p: Partial<IntranetPostReturnFields>): IntranetPostReturnFields {
  return {
    rwr_result: "",
    rwr_sno: "",
    rwr_type: "",
    rwr_orderkey: "",
    rwr_resmsg: "",
    ...p,
  };
}

describe("parseIntranetPostResponse", () => {
  it("쿼리스트링·평문 본문에서 rwr_result 추출", () => {
    expect(
      parseIntranetPostResponse({
        status: 200,
        bodyText: "ok&rwr_result=0&rwr_orderkey=ABC123",
        locationHeader: null,
      })
    ).toEqual(rf({ rwr_result: "0", rwr_orderkey: "ABC123" }));
  });

  it("Location 리다이렉트 URL에서만 추출", () => {
    expect(
      parseIntranetPostResponse({
        status: 302,
        bodyText: "<html></html>",
        locationHeader: "https://shop.example/po-return?rwr_result=20&rwr_orderkey=DUPE",
      })
    ).toEqual(rf({ rwr_result: "20", rwr_orderkey: "DUPE" }));
  });

  it("본문 우선, 없으면 Location", () => {
    expect(
      parseIntranetPostResponse({
        status: 302,
        bodyText: "rwr_result=0",
        locationHeader: "https://x/?rwr_result=99",
      })
    ).toEqual(rf({ rwr_result: "0" }));
  });

  it("HTML hidden input (name→value 순)", () => {
    const html = `<form><input type="hidden" name="rwr_result" value="0" />
      <input type="hidden" name="rwr_orderkey" value="KEY%2F1" /></form>`;
    expect(parseIntranetPostResponse({ status: 200, bodyText: html, locationHeader: null })).toEqual(
      rf({ rwr_result: "0", rwr_orderkey: "KEY/1" })
    );
  });

  it("HTML hidden input (value→name 순)", () => {
    const html = `<input value="11" name="rwr_result" />`;
    expect(parseIntranetPostResponse({ status: 200, bodyText: html, locationHeader: null }).rwr_result).toBe("11");
  });

  it("JSON 조각", () => {
    const body = `callback({"rwr_result":"0","rwr_orderkey":"ORD-가"})`;
    expect(parseIntranetPostResponse({ status: 200, bodyText: body, locationHeader: null })).toEqual(
      rf({ rwr_result: "0", rwr_orderkey: "ORD-가" })
    );
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

  it("document.location.href 스크립트에서 반환변수·빈 rwr_orderkey", () => {
    const html = `<script type='text/javascript'>
      document.location.href = 'https://shop.example/po-return?rwr_result=2&rwr_sno=0000-ab7e&rwr_type=1&rwr_orderkey=&rwr_resmsg=bad';
      </script>`;
    expect(parseIntranetPostResponse({ status: 200, bodyText: html, locationHeader: null })).toEqual(
      rf({
        rwr_result: "2",
        rwr_sno: "0000-ab7e",
        rwr_type: "1",
        rwr_orderkey: "",
        rwr_resmsg: "bad",
      })
    );
  });
});

describe("buildIntranetPostReturnSnapshot", () => {
  it("kind·payload(var_ret 스타일)로 고정 순서", () => {
    const snap = buildIntranetPostReturnSnapshot(
      rf({ rwr_result: "0", rwr_sno: "s", rwr_type: "1", rwr_orderkey: "k", rwr_resmsg: "" })
    );
    expect(snap.kind).toBe("intranet_post_return");
    expect(Object.keys(snap.payload).join(",")).toBe("rwr_result,rwr_sno,rwr_type,rwr_orderkey,rwr_resmsg");
  });
});

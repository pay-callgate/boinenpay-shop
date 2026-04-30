import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import { parseIntranetPostResponse } from "@/lib/newrun/parse-intranet-post-response";
import {
  charsetFromContentTypeHeader,
  readIntranetPostResponseBodyText,
} from "@/lib/newrun/intranet-post-response-body";

describe("intranet-post-response-body", () => {
  it("Content-Type charset 을 따른다", async () => {
    const buf = iconv.encode("가", "euc-kr");
    const res = new Response(buf, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=euc-kr" },
    });
    expect(await readIntranetPostResponseBodyText(res)).toBe("가");
  });

  it("charset 없으면 EUC-KR 기본 디코드", async () => {
    const inner = `<!--주석한글--><script>document.location.href='https://x/?a=1'</script>`;
    const buf = iconv.encode(inner, "euc-kr");
    const res = new Response(buf, { status: 200, headers: { "Content-Type": "text/html" } });
    const text = await readIntranetPostResponseBodyText(res);
    expect(text).toContain("주석한글");
  });

  it("EUC-KR HTML 본문 + 스크립트 URL의 EUC-KR 퍼센트 rwr_resmsg 가 끝까지 한글", async () => {
    const msg = "불일치 오류";
    const pct = Buffer.from(iconv.encode(msg, "euc-kr"))
      .toString("hex")
      .match(/.{2}/g)!
      .map((b) => "%" + b.toUpperCase())
      .join("");
    const inner = `<!--${"메타"}--><script>document.location.href='https://shop/po?rwr_result=2&rwr_resmsg=${pct}';</script>`;
    const buf = iconv.encode(inner, "euc-kr");
    const res = new Response(buf, { status: 200, headers: { "Content-Type": "text/html" } });
    const bodyText = await readIntranetPostResponseBodyText(res);
    const parsed = parseIntranetPostResponse({ status: 200, bodyText, locationHeader: null });
    expect(parsed.rwr_resmsg).toBe(msg);
  });

  it("charsetFromContentTypeHeader", () => {
    expect(charsetFromContentTypeHeader('text/html; charset="euc-kr"')).toBe("euc-kr");
    expect(charsetFromContentTypeHeader(null)).toBeNull();
  });
});

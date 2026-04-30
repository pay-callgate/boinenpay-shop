import { describe, expect, it } from "vitest";
import iconv from "iconv-lite";
import {
  decodeFormBytesAsUtf8FromEucKr,
  encodeNewrunIntranetPostBody,
  encodeWwwFormValueEucKr,
  parseRawSearchParamsEucKrValues,
  pickBestParsedQueryFromSearchFragments,
  repairLatin1BytesAsEucKrToUtf8,
} from "@/lib/newrun/euc-kr-wire";

describe("euc-kr-wire", () => {
  it("한글 폼 값을 EUC-KR 퍼센트 인코딩했다가 디코딩하면 원문과 같다", () => {
    const v = "수주화원 테스트  가나";
    const enc = encodeWwwFormValueEucKr(v);
    expect(enc).toMatch(/%[0-9A-F]{2}/);
    expect(decodeFormBytesAsUtf8FromEucKr(enc)).toBe(v);
  });

  it("parseRawSearchParamsEucKrValues 가 EUC-KR 퍼센트 쿼리를 UTF-8 문자열로 복원한다", () => {
    const hangul = "화원상호";
    const pct = Buffer.from(iconv.encode(hangul, "euc-kr"))
      .toString("hex")
      .match(/.{2}/g)!
      .map((b) => "%" + b.toUpperCase())
      .join("");
    const raw = `?var_name=${pct}`;
    const q = parseRawSearchParamsEucKrValues(raw);
    expect(q.var_name).toBe(hangul);
  });

  it("encodeNewrunIntranetPostBody 가 본문을 키=값& 형태로 만든다", () => {
    const body = encodeNewrunIntranetPostBody({ rw_aname: "홍길동", rw_memo: "" });
    expect(body.startsWith("rw_sender=")).toBe(true);
    expect(body).toContain("rw_aname=");
    expect(body).toContain("&");
    const first = body.split("&").find((p) => p.startsWith("rw_aname="))!;
    const valPart = first.slice("rw_aname=".length);
    expect(decodeFormBytesAsUtf8FromEucKr(valPart)).toBe("홍길동");
  });

  it("repairLatin1BytesAsEucKrToUtf8 가 EUC-KR 바이트를 Latin-1로 잘못 본 문자열을 복구한다", () => {
    const hangul = "화원상호";
    const buf = Buffer.from(iconv.encode(hangul, "euc-kr"));
    const mojibake = buf.toString("latin1");
    expect(repairLatin1BytesAsEucKrToUtf8(mojibake)).toBe(hangul);
  });

  it("pickBestParsedQueryFromSearchFragments 가 더 나은 디코딩 결과를 고른다", () => {
    const hangul = "테스트화원";
    const pct = Buffer.from(iconv.encode(hangul, "euc-kr"))
      .toString("hex")
      .match(/.{2}/g)!
      .map((b) => "%" + b.toUpperCase())
      .join("");
    const good = `?var_corp=${pct}`;
    const weak = "?var_corp=ASCII-ONLY"; // 한글 없음 → 총점 낮음
    const parsed = pickBestParsedQueryFromSearchFragments([weak, good]);
    expect(parsed.var_corp).toBe(hangul);
  });
});

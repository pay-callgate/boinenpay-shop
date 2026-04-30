/**
 * ext2intra intranet_post 응답 HTML: 레거시 EUC-KR(CP949)인 경우가 많음.
 * `Response.text()`는 기본 UTF-8이라 본문·스크립트 내 URL이 선깨짐 → rwr_resmsg 복구 불가.
 */

import iconv from "iconv-lite";

/** 헤더·메타에 charset 없을 때(뉴런 실측 대비) */
export const NEWRUN_INTRANET_POST_RESPONSE_DEFAULT_CHARSET = "euc-kr";

export function charsetFromContentTypeHeader(ct: string | null): string | null {
  if (!ct) return null;
  const m = ct.match(/charset\s*=\s*([^;]+)/i);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function normalizeIconvEncoding(label: string): string {
  const x = label.trim().replace(/^["']|["']$/g, "").toLowerCase();
  if (x === "windows-949" || x === "cp949" || x === "ks_c_5601-1987" || x === "ksc5601") {
    return "euc-kr";
  }
  return x;
}

export function decodeBufferAsHtmlString(buf: Buffer, charset: string): string {
  const enc = normalizeIconvEncoding(charset);
  try {
    if (enc === "utf-8" || enc === "utf8") return buf.toString("utf8");
    if (iconv.encodingExists(enc)) return iconv.decode(buf, enc);
  } catch {
    /* fall through */
  }
  return buf.toString("utf8");
}

/**
 * HTML 상단에서 charset 힌트 (바이트는 그대로 두고 Latin-1로 ASCII 구간만 읽음)
 */
export function sniffCharsetFromHtmlBuffer(buf: Buffer, maxScan = 16384): string | null {
  const n = Math.min(buf.length, maxScan);
  const s = buf.subarray(0, n).toString("latin1");

  const metaCharset = s.match(/<meta\s+[^>]*charset\s*=\s*["']?\s*([^"'>\s/]+)/i);
  if (metaCharset?.[1]) return metaCharset[1];

  const httpEquiv = s.match(
    /<meta\s+[^>]*http-equiv\s*=\s*["']?\s*content-type["']?[^>]*content\s*=\s*["']([^"']+)["']/i
  );
  if (httpEquiv?.[1]) return charsetFromContentTypeHeader(httpEquiv[1]);

  return null;
}

/**
 * intranet_post 응답 본문을 텍스트로 읽음 (EUC-KR 우선).
 * `fetch` mock 등으로 `arrayBuffer` 실패 시 `text()` 폴백.
 */
export async function readIntranetPostResponseBodyText(res: Response): Promise<string> {
  let buf: Buffer | null = null;
  try {
    if (typeof res.arrayBuffer === "function") {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 0) buf = Buffer.from(ab);
    }
  } catch {
    buf = null;
  }

  if (buf) {
    const ct = res.headers.get("content-type");
    let charset = charsetFromContentTypeHeader(ct) ?? sniffCharsetFromHtmlBuffer(buf);
    if (!charset) charset = NEWRUN_INTRANET_POST_RESPONSE_DEFAULT_CHARSET;
    return decodeBufferAsHtmlString(buf, charset);
  }

  return await res.text();
}

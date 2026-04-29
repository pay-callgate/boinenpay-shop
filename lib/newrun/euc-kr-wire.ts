import iconv from "iconv-lite";

/**
 * application/x-www-form-urlencoded 값 인코딩(x-www 규칙: 스페이스는 '+', 나머지 비 ASCII·특수문자는 %HH).
 * 값 문자열은 EUC-KR 바이트로 보내 뉴런 PHP와 동일한 디코딩 경로를 탄다.
 */
export function encodeWwwFormValueEucKr(value: string): string {
  const buf = iconv.encode(value, "euc-kr");
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]!;
    if (b === 0x20) {
      out += "+";
    } else if (
      (b >= 0x30 && b <= 0x39) ||
      (b >= 0x41 && b <= 0x5a) ||
      (b >= 0x61 && b <= 0x7a) ||
      b === 0x2d ||
      b === 0x5f ||
      b === 0x2e ||
      b === 0x2a
    ) {
      out += String.fromCharCode(b);
    } else {
      out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

/**
 * intranet_post 전송용 본문. 키 이름은 ASCII이므로 encodeURIComponent 사용.
 */
export function encodeNewrunIntranetPostBody(fields: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(`${encodeURIComponent(k)}=${encodeWwwFormValueEucKr(v)}`);
  }
  return parts.join("&");
}

/**
 * 쿼리/폼 조각에서 + → 공백, %HH → 바이트 후 EUC-KR 디코딩.
 */
export function decodeFormBytesAsUtf8FromEucKr(encoded: string): string {
  const bytes: number[] = [];
  let i = 0;
  while (i < encoded.length) {
    if (encoded[i] === "+") {
      bytes.push(0x20);
      i++;
    } else if (encoded[i] === "%" && i + 2 < encoded.length) {
      const h = encoded.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(h)) {
        bytes.push(parseInt(h, 16));
        i += 3;
        continue;
      }
      bytes.push(encoded.charCodeAt(i) & 0xff);
      i++;
    } else {
      bytes.push(encoded.charCodeAt(i) & 0xff);
      i++;
    }
  }
  return iconv.decode(Buffer.from(bytes), "euc-kr");
}

/**
 * `?a=1&b=...` 형태. 키는 URI 디코딩(ASCII), 값은 EUC-KR 바이트 디코딩.
 */
export function parseRawSearchParamsEucKrValues(rawSearch: string): Record<string, string> {
  const q = rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch;
  const out: Record<string, string> = {};
  if (!q) return out;
  for (const pair of q.split("&")) {
    if (pair === "") continue;
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawVal = eq === -1 ? "" : pair.slice(eq + 1);
    let key: string;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, " "));
    } catch {
      key = rawKey;
    }
    out[key] = decodeFormBytesAsUtf8FromEucKr(rawVal);
  }
  return out;
}

import iconv from "iconv-lite";

/** 뉴런 var_ret: 복수 디코딩 후보 중 '한글 정상도'가 가장 높은 문자열 선택 */
export function scoreVarRetDecodedValue(s: string): number {
  if (s == null) return -1e9;
  let score = 0;
  if (s.includes("\uFFFD")) score -= 80;
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i)!;
    if (cp >= 0xac00 && cp <= 0xd7a3) score += 4;
    else if (cp >= 0x3130 && cp <= 0x318f) score += 1;
    else if ((cp >= 0x61 && cp <= 0x7a) || (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x30 && cp <= 0x39))
      score += 0.05;
    if (cp > 0xffff) i++;
  }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s)) score -= 25;
  return score;
}

export function pickBestVarRetString(candidates: readonly string[]): string {
  let best = candidates[0] ?? "";
  let bestSc = scoreVarRetDecodedValue(best);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const sc = scoreVarRetDecodedValue(c);
    if (sc > bestSc) {
      best = c;
      bestSc = sc;
    }
  }
  return best;
}

/** EUC-KR 바이트가 Latin-1 코드 단위로 잘못 들어온 경우 복구 시도 */
export function repairLatin1BytesAsEucKrToUtf8(s: string): string {
  if (!s) return s;
  try {
    return iconv.decode(Buffer.from(s, "latin1"), "euc-kr");
  } catch {
    return s;
  }
}

/**
 * 쿼리 값 조각(아직 application/x-www-form-urlencoded 규칙: +, %HH).
 * — EUC-KR 퍼센트 디코딩(뉴런 PHP 기본)
 * — UTF-8 퍼센트 디코딩(일부 환경)
 * — Latin-1 → EUC-KR 복구(이미 한 차원 깨진 문자열)
 */
export function decodeNewrunVarRetUrlValue(rawVal: string): string {
  const c: string[] = [];
  c.push(decodeFormBytesAsUtf8FromEucKr(rawVal));
  try {
    const utf8Decoded = decodeURIComponent(rawVal.replace(/\+/g, " "));
    c.push(utf8Decoded);
    c.push(repairLatin1BytesAsEucKrToUtf8(utf8Decoded));
  } catch {
    /* ignore */
  }
  c.push(repairLatin1BytesAsEucKrToUtf8(decodeFormBytesAsUtf8FromEucKr(rawVal)));
  return pickBestVarRetString(c);
}

/**
 * 런타임이 이미 디코딩한 값(퍼센트 없음). Latin-1·UTF-8 찌꺼기 복구만 시도.
 */
export function refineAlreadyDecodedVarRetValue(s: string): string {
  if (!s) return s;
  return pickBestVarRetString([s, repairLatin1BytesAsEucKrToUtf8(s)]);
}

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
    out[key] = decodeNewrunVarRetUrlValue(rawVal);
  }
  return out;
}

/** 여러 쿼리스트링 후보 중 필드 합산 점수가 가장 좋은 파싱 결과 선택 */
export function pickBestParsedQueryFromSearchFragments(fragments: readonly string[]): Record<string, string> {
  let best: Record<string, string> = {};
  let bestTotal = -1e9;
  for (const frag of fragments) {
    const q = frag.startsWith("?") ? frag : frag ? `?${frag}` : "";
    if (q.length <= 1) continue;
    const m = parseRawSearchParamsEucKrValues(q);
    let total = 0;
    for (const v of Object.values(m)) total += scoreVarRetDecodedValue(v);
    if (total > bestTotal) {
      bestTotal = total;
      best = m;
    }
  }
  return best;
}

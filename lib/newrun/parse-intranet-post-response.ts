/**
 * intranet_post 응답에서 rwr_* 추출 (HTML 본문·Location 쿼리 등 혼합 대비).
 * 가이드 2.1.4 반환변수 + 현장에서 함께 오는 rwr_resmsg.
 */

import {
  decodeNewrunVarRetUrlValue,
  parseRawSearchParamsEucKrValues,
  refineAlreadyDecodedVarRetValue,
} from "@/lib/newrun/euc-kr-wire";

/** 스냅샷·화면 노출 시 가이드 표 순서 */
export const INTRANET_POST_RETURN_SNAPSHOT_KEYS = [
  "rwr_result",
  "rwr_sno",
  "rwr_type",
  "rwr_orderkey",
  "rwr_resmsg",
] as const;

export type IntranetPostReturnSnapshotKey = (typeof INTRANET_POST_RETURN_SNAPSHOT_KEYS)[number];

export type IntranetPostReturnFields = Record<IntranetPostReturnSnapshotKey, string>;

export type NewrunIntranetPostReturnMessage = {
  kind: "intranet_post_return";
  payload: IntranetPostReturnFields;
};

function emptyReturnFields(): IntranetPostReturnFields {
  return {
    rwr_result: "",
    rwr_sno: "",
    rwr_type: "",
    rwr_orderkey: "",
    rwr_resmsg: "",
  };
}

function decodeOrderKey(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

/** rwr_resmsg 등 (이미 디코딩된 쿼리 값·퍼센트 인코딩 혼재) */
function normalizeRwrMessageValue(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    return decodeNewrunVarRetUrlValue(trimmed);
  }
  return refineAlreadyDecodedVarRetValue(trimmed);
}

function parseUrlQuery(urlString: string): Record<string, string> {
  try {
    const u = new URL(urlString, "https://intranet-post.invalid");
    return parseRawSearchParamsEucKrValues(u.search);
  } catch {
    const q = urlString.indexOf("?");
    if (q >= 0) return parseRawSearchParamsEucKrValues(urlString.slice(q));
    return {};
  }
}

/** HTML/스크립트에서 리다이렉트 대상 URL 후보 */
function extractRedirectUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  const patterns: RegExp[] = [
    /document\.location\.href\s*=\s*['"]([^'"]+)['']/gi,
    /document\.location\s*=\s*['"]([^'"]+)['']/gi,
    /window\.location\.href\s*=\s*['"]([^'"]+)['']/gi,
    /window\.location\s*=\s*['"]([^'"]+)['']/gi,
    /(?:^|[;\s])location\.href\s*=\s*['"]([^'"]+)['']/gi,
    /http-equiv\s*=\s*['"]refresh['"][^>]*content\s*=\s*['"]\s*\d+\s*;\s*url\s*=\s*([^\s'">]+)/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) != null) {
      const u = m[1]?.trim();
      if (u) urls.push(u);
    }
  }
  return urls;
}

function pickRwrFromQuery(q: Record<string, string>): Partial<IntranetPostReturnFields> {
  const out: Partial<IntranetPostReturnFields> = {};
  for (const k of INTRANET_POST_RETURN_SNAPSHOT_KEYS) {
    const v = q[k];
    if (v !== undefined) {
      out[k] = k === "rwr_resmsg" ? refineAlreadyDecodedVarRetValue(v) : v;
    }
  }
  return out;
}

function mergeRwrFields(
  base: IntranetPostReturnFields,
  overlay: Partial<IntranetPostReturnFields>
): IntranetPostReturnFields {
  const next = { ...base };
  for (const k of INTRANET_POST_RETURN_SNAPSHOT_KEYS) {
    if (overlay[k] !== undefined) next[k] = overlay[k]!;
  }
  return next;
}

function extractFromPlainText(text: string): Partial<IntranetPostReturnFields> {
  const pick = (name: string): string | undefined =>
    text.match(new RegExp(`["']${name}["']\\s*:\\s*["']([^"']*)["']`, "i"))?.[1] ??
    text.match(new RegExp(`(?:^|[&?])${name}=([^&#'"]*)`, "i"))?.[1] ??
    text.match(new RegExp(`${name}["']?\\s*[=:]\\s*["']?([^&"'<>\n\r]+)`, "i"))?.[1] ??
    text.match(
      new RegExp(`name\\s*=\\s*["']${name}["'][^>]*value\\s*=\\s*["']([^"']*)["']`, "i")
    )?.[1] ??
    text.match(
      new RegExp(`value\\s*=\\s*["']([^"']*)["'][^>]*name\\s*=\\s*["']${name}["']`, "i")
    )?.[1];

  const rwr_result = pick("rwr_result");
  const rwr_sno = pick("rwr_sno");
  const rwr_type = pick("rwr_type");
  let rwr_orderkey = pick("rwr_orderkey");
  if (rwr_orderkey !== undefined) rwr_orderkey = decodeOrderKey(rwr_orderkey);
  let rwr_resmsg = pick("rwr_resmsg");
  if (rwr_resmsg !== undefined) rwr_resmsg = normalizeRwrMessageValue(rwr_resmsg);

  const out: Partial<IntranetPostReturnFields> = {};
  if (rwr_result !== undefined) out.rwr_result = rwr_result;
  if (rwr_sno !== undefined) out.rwr_sno = rwr_sno;
  if (rwr_type !== undefined) out.rwr_type = rwr_type;
  if (rwr_orderkey !== undefined) out.rwr_orderkey = rwr_orderkey;
  if (rwr_resmsg !== undefined) out.rwr_resmsg = rwr_resmsg;
  return out;
}

function mergeFromTextInto(fields: IntranetPostReturnFields, bodyText: string): IntranetPostReturnFields {
  let merged = { ...fields };
  for (const href of extractRedirectUrlsFromText(bodyText)) {
    merged = mergeRwrFields(merged, pickRwrFromQuery(parseUrlQuery(href)));
  }
  merged = mergeRwrFields(merged, extractFromPlainText(bodyText));
  return merged;
}

/**
 * intranet_post HTTP 응답에서 반환변수 정리.
 * 본문(스크립트 리다이렉트 URL 등)이 Location 보다 우선합니다.
 */
export function parseIntranetPostResponse(args: {
  status: number;
  bodyText: string;
  locationHeader: string | null;
}): IntranetPostReturnFields {
  let fields = emptyReturnFields();

  const loc = args.locationHeader?.trim() ?? "";
  if (loc) {
    fields = mergeRwrFields(fields, pickRwrFromQuery(parseUrlQuery(loc)));
  }

  fields = mergeFromTextInto(fields, args.bodyText);

  return fields;
}

/** var_ret postMessage와 동일한 `{ kind, payload }` 형태 (관리자 스냅샷용) */
export function buildIntranetPostReturnSnapshot(fields: IntranetPostReturnFields): NewrunIntranetPostReturnMessage {
  const payload = emptyReturnFields();
  for (const k of INTRANET_POST_RETURN_SNAPSHOT_KEYS) {
    payload[k] = fields[k] ?? "";
  }
  return { kind: "intranet_post_return", payload };
}

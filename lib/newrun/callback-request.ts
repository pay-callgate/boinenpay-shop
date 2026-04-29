import type { NextRequest } from "next/server";
import iconv from "iconv-lite";
import {
  parseRawSearchParamsEucKrValues,
  pickBestParsedQueryFromSearchFragments,
  refineAlreadyDecodedVarRetValue,
  scoreVarRetDecodedValue,
} from "@/lib/newrun/euc-kr-wire";

function objectFromSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export function extractSearchFromHref(href: string): string {
  try {
    const q = href.indexOf("?");
    if (q === -1) return "";
    const hash = href.indexOf("#", q);
    return hash === -1 ? href.slice(q) : href.slice(q, hash);
  } catch {
    return "";
  }
}

/** request.url / nextUrl.search / 프록시 URI 등 쿼리 후보(중복 제거) */
export function collectVarRetSearchFragments(request: NextRequest): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (t && t !== "?" && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };

  push(extractSearchFromHref(request.url));
  const fromNext = request.nextUrl.search;
  if (fromNext) push(fromNext);

  const xfwd =
    request.headers.get("x-forwarded-uri") ??
    request.headers.get("x-middleware-request-url") ??
    request.headers.get("x-invoke-path") ??
    "";
  if (xfwd.includes("?")) {
    const path = xfwd.startsWith("http") ? xfwd : `http://placeholder${xfwd.startsWith("/") ? "" : "/"}${xfwd}`;
    push(extractSearchFromHref(path));
  }

  return out;
}

function parseVarRetQueryBestEffort(request: NextRequest): Record<string, string> {
  const fragments = collectVarRetSearchFragments(request);
  const meaningful = fragments.filter((f) => f.length > 1);

  if (meaningful.length > 0) {
    let query = pickBestParsedQueryFromSearchFragments(meaningful);
    if (Object.keys(query).length === 0) {
      query = parseRawSearchParamsEucKrValues(
        meaningful[0]!.startsWith("?") ? meaningful[0]! : `?${meaningful[0]}`
      );
    }
    const spSize = request.nextUrl.searchParams.size;
    if (spSize > 0) {
      request.nextUrl.searchParams.forEach((value, key) => {
        const refined = refineAlreadyDecodedVarRetValue(value);
        const prev = query[key];
        if (prev == null || prev === "") {
          query[key] = refined;
        } else if (scoreVarRetDecodedValue(refined) > scoreVarRetDecodedValue(prev)) {
          query[key] = refined;
        }
      });
    }
    return query;
  }

  const fromParams = objectFromSearchParams(request.nextUrl.searchParams);
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(fromParams)) {
    query[key] = refineAlreadyDecodedVarRetValue(value);
  }
  return query;
}

function refineBodyStringMap(body: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    out[k] = refineAlreadyDecodedVarRetValue(v);
  }
  return out;
}

/**
 * var_ret 요청에서 쿼리 + (POST 시) 본문을 평문 객체로 수집.
 * 협회/뉴런 레거시는 EUC-KR·UTF-8·Latin-1 깨짐이 혼재할 수 있어 후보 비교 후 선택.
 */
export async function parseNewrunVarRetRequest(request: NextRequest): Promise<{
  query: Record<string, string>;
  body: Record<string, string> | null;
}> {
  const query = parseVarRetQueryBestEffort(request);

  if (request.method === "GET" || request.method === "HEAD") {
    return { query, body: null };
  }

  const ct = request.headers.get("content-type") ?? "";

  if (ct.includes("application/json")) {
    try {
      const raw = (await request.json()) as unknown;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const body: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (v == null) body[k] = "";
          else if (typeof v === "string") body[k] = v;
          else body[k] = JSON.stringify(v);
        }
        return { query, body: refineBodyStringMap(body) };
      }
    } catch {
      /* fallthrough */
    }
    return { query, body: {} };
  }

  if (ct.includes("application/x-www-form-urlencoded")) {
    const buf = Buffer.from(await request.arrayBuffer());
    const text = iconv.decode(buf, "euc-kr").trim();
    const forParse = text.startsWith("?") ? text : `?${text}`;
    const body = refineBodyStringMap(parseRawSearchParamsEucKrValues(forParse));
    return { query, body };
  }

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const body: Record<string, string> = {};
    form.forEach((value, key) => {
      const s = typeof value === "string" ? value : value.name;
      body[key] = refineAlreadyDecodedVarRetValue(s);
    });
    return { query, body };
  }

  try {
    const text = await request.text();
    if (!text.trim()) return { query, body: null };
    return { query, body: { raw: text } };
  } catch {
    return { query, body: null };
  }
}

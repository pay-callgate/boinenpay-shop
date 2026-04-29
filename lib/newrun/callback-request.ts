import type { NextRequest } from "next/server";
import iconv from "iconv-lite";
import { parseRawSearchParamsEucKrValues } from "@/lib/newrun/euc-kr-wire";

function objectFromSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * var_ret 요청에서 쿼리 + (POST 시) 본문을 평문 객체로 수집.
 * 협회/뉴런 레거시는 EUC-KR 바이트를 URL·폼으로 보내므로 디코딩을 맞춘다.
 */
export async function parseNewrunVarRetRequest(request: NextRequest): Promise<{
  query: Record<string, string>;
  body: Record<string, string> | null;
}> {
  const rawSearch = request.nextUrl.search;
  const query =
    rawSearch.length > 1
      ? parseRawSearchParamsEucKrValues(rawSearch)
      : objectFromSearchParams(request.nextUrl.searchParams);

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
        return { query, body };
      }
    } catch {
      /* fallthrough */
    }
    return { query, body: {} };
  }

  if (ct.includes("application/x-www-form-urlencoded")) {
    const buf = Buffer.from(await request.arrayBuffer());
    const text = iconv.decode(buf, "euc-kr");
    const sp = new URLSearchParams(text);
    const body: Record<string, string> = {};
    sp.forEach((value, key) => {
      body[key] = value;
    });
    return { query, body };
  }

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const body: Record<string, string> = {};
    form.forEach((value, key) => {
      body[key] = typeof value === "string" ? value : value.name;
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

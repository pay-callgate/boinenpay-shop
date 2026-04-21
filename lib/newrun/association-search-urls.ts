/**
 * 뉴런 개발문서 2.2 수주화원 검색, 2.3 상품 검색, 2.4 옵션상품 검색 — 호출 URL 조립.
 * `rose_session`·`var_ret`는 URL 쿼리로 전달되므로 인코딩은 URLSearchParams에 위임.
 */

function normalizeAssocBase(assocBaseUrl: string): string {
  const t = assocBaseUrl.trim().replace(/\/$/, "");
  if (!t) throw new Error("association base URL is empty");
  return t;
}

/** 문서 2.2.2 — member_search.htm */
export function buildMemberSearchUrl(params: {
  assocBaseUrl: string;
  roseSession: string;
  varRetUrl: string;
}): string {
  const base = normalizeAssocBase(params.assocBaseUrl);
  const u = new URL(`${base}/member_ext/member_search.htm`);
  u.searchParams.set("ms", "2");
  u.searchParams.set("callroseweb", "ext_home");
  u.searchParams.set("rose_session", params.roseSession);
  u.searchParams.set("var_ret", params.varRetUrl);
  return u.toString();
}

/** 문서 2.3.2 — check_good_ext.htm */
export function buildProductSearchUrl(params: {
  assocBaseUrl: string;
  roseSession: string;
  varRetUrl: string;
}): string {
  const base = normalizeAssocBase(params.assocBaseUrl);
  const u = new URL(`${base}/member_ext/check_good_ext.htm`);
  u.searchParams.set("callroseweb", "ext_home");
  u.searchParams.set("rose_session", params.roseSession);
  u.searchParams.set("var_ret", params.varRetUrl);
  return u.toString();
}

/** 문서 2.4.2 — option_item_ext.htm */
export function buildOptionSearchUrl(params: {
  assocBaseUrl: string;
  roseSession: string;
  varRetUrl: string;
}): string {
  const base = normalizeAssocBase(params.assocBaseUrl);
  const u = new URL(`${base}/member_ext/option_item_ext.htm`);
  u.searchParams.set("callroseweb", "ext_home");
  u.searchParams.set("rose_session", params.roseSession);
  u.searchParams.set("var_ret", params.varRetUrl);
  return u.toString();
}

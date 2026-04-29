/**
 * 뉴런 intranet_post(2013 레거시) PHP 스냅샷과 동일한 `rw_*` 키 풀.
 * POST 페이로드에는 이 키만 포함한다(초깃값 "" → 매핑으로 채움).
 */

export const INTRANET_POST_RW_KEYS = [
  "rw_sender",
  "rw_style",
  "rw_type",
  "rw_method",
  "rw_sno",
  "rw_returnurl",
  "rw_rosewebid",
  "rw_rosewebpw",
  "rw_assoc",
  "rw_sendsms",
  "rw_sendfax",
  "rw_price",
  "rw_aname",
  "rw_atel",
  "rw_arrive_place1",
  "rw_arrive_place2",
  "rw_bdate",
  "rw_memo",
  "rw_shopreq",
  "rw_shopreq1",
  "rw_shopreq2",
  "rw_sendpeople",
  "rw_kyungjo",
  "rw_jname",
  "rw_jhandtel",
  "rw_sujuid",
  "rw_menucode",
  "rw_qty",
  "rw_origin_price",
] as const;

export type IntranetPostRwKey = (typeof INTRANET_POST_RW_KEYS)[number];

const KEY_SET = new Set<string>(INTRANET_POST_RW_KEYS);

export function isIntranetPostRwKey(k: string): k is IntranetPostRwKey {
  return KEY_SET.has(k);
}

/** 모든 intranet_post `rw_*` 필드를 "" 로 초기화 */
export function buildEmptyRwForm(): Record<IntranetPostRwKey, string> {
  const o = {} as Record<IntranetPostRwKey, string>;
  for (const k of INTRANET_POST_RW_KEYS) o[k] = "";
  return o;
}

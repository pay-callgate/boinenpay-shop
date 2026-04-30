/**
 * 뉴런 intranet_post 발주연동 가이드(2.1.3 전달변수) 행 순서와 동일하게 정렬.
 * POST 본문은 `encodeNewrunIntranetPostBody`에서 이 배열 순서를 따른다(레거시 PHP와 동일 순서 유지).
 * 미사용 변수는 "" 로 전송한다.
 */

export const INTRANET_POST_RW_KEYS = [
  "rw_sender",
  "rw_style",
  "rw_method",
  "rw_sno",
  "rw_returnurl",
  "rw_rosewebid",
  "rw_rosewebpw",
  "rw_sendsms",
  "rw_sendfax",
  "rw_assoc",
  "rw_associd",
  "rw_sujuid",
  "rw_bdate",
  "rw_btime",
  "rw_menucode",
  "rw_menu_etc",
  "rw_qty",
  "rw_price",
  "rw_origin_price",
  "rw_jname",
  "rw_jtel",
  "rw_jhandtel",
  "rw_aname",
  "rw_atel",
  "rw_ahandtel",
  "rw_arrive_place1",
  "rw_arrive_place2",
  "rw_kyungjo",
  "rw_sendpeople",
  "rw_card",
  "rw_memo",
  "rw_shopreq1",
  "rw_shopreq2",
  "rw_custreq",
  "rw_photourl",
  "rw_type",
  "rw_paymethod",
  "rw_writer",
  "rw_dica",
  "rw_happycall",
  "rw_item_name",
  "rw_item_key",
  "rw_item_price",
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

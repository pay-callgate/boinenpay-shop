/**
 * 뉴런 intranet_post용 `rw_*` 폼 필드 매핑 (문서 2.1.3 / Phase 4).
 * 키 풀은 `INTRANET_POST_RW_KEYS`와 동일 — 비표준 키는 POST에 넣지 않는다.
 */

import {
  buildEmptyRwForm,
  INTRANET_POST_RW_KEYS,
  isIntranetPostRwKey,
  type IntranetPostRwKey,
} from "@/lib/newrun/intranet-post-field-template";

/** T4.4: 쇼핑몰 고유번호 — `order_no` 권장(사람이 읽기 쉬움). 동일 값 재전송 시 뉴런 결과코드 20 등 멱등 정책은 Phase 5에서 처리. */
export type NewrunRwSnoSource = "order_no" | "order_id";

export class NewrunPayloadValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(issues.join("; "));
    this.name = "NewrunPayloadValidationError";
  }
}

const RW_SENDER_DEFAULT = "100";
const RW_STYLE_DEFAULT = "0";
/** 가이드: Y/N (미발송 N) */
const RW_SMS_DEFAULT = "N";
const RW_FAX_DEFAULT = "N";

const NEWRUN_DEFAULT_SENDPEOPLE =
  process.env.NEWRUN_DEFAULT_RW_SENDPEOPLE?.trim() ?? "주식회사 콜게이트 대표이사 아무개";

/**
 * `rw_menucode`는 오직 병합된 `newrun_*_product_draft` 등에서 온 값만 사용한다.
 * 쇼핑몰 상품명(`product.name`)이나 품목 스냅샷의 `product_name`으로 매핑하지 않는다.
 */

/** 문자열 필드 상한(보수적). 뉴런 문서·실측에 맞춰 조정 가능. */
export const NEWRUN_RW_STRING_LIMITS: Record<string, number> = {
  rw_sender: 20,
  rw_style: 20,
  rw_method: 10,
  rw_sno: 255,
  rw_returnurl: 255,
  rw_rosewebid: 19,
  rw_rosewebpw: 70,
  rw_sendsms: 1,
  rw_sendfax: 1,
  rw_assoc: 20,
  rw_associd: 20,
  rw_sujuid: 20,
  rw_bdate: 10,
  rw_btime: 60,
  rw_menucode: 8,
  rw_menu_etc: 100,
  rw_jname: 20,
  rw_jtel: 20,
  rw_jhandtel: 20,
  rw_aname: 100,
  rw_atel: 20,
  rw_ahandtel: 20,
  rw_arrive_place1: 250,
  rw_arrive_place2: 250,
  rw_kyungjo: 150,
  rw_sendpeople: 100,
  rw_card: 2000,
  rw_memo: 2000,
  rw_shopreq1: 2000,
  rw_shopreq2: 2000,
  rw_custreq: 2000,
  rw_photourl: 250,
  rw_type: 10,
  rw_paymethod: 10,
  rw_writer: 20,
  rw_dica: 1,
  rw_happycall: 1,
  rw_item_name: 100,
  rw_item_key: 100,
  rw_item_price: 100,
};

/** `shipping_detail` 블록에서 장소 상세 첫 줄(화훼 주문서 포맷) */
export function extractFloristVenueLineFromShippingDetail(
  shippingDetail: string | null | undefined
): string {
  const s = (shippingDetail ?? "").trim();
  if (!s) return "";
  const head = s.split(/\n\s*\n/)[0] ?? s;
  const line = head.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.trim();
}

export type NewrunOrderSlice = {
  id: string;
  order_no: string;
  payment_status: string;
  total_amount: number | string;
  shipping_name: string;
  shipping_phone: string;
  shipping_postcode?: string | null;
  shipping_address: string;
  shipping_detail?: string | null;
  created_at?: string;
  /** 희망 배송일 (DB DATE → 보통 YYYY-MM-DD) */
  desired_delivery_date?: string | null;
  /** 희망 배송 시간대(쇼핑몰) — 예: 14:00~16:00 → rw_btime 보조 */
  delivery_time_slot?: string | null;
  orderer_name?: string | null;
  ribbon_sender?: string | null;
  ribbon_message?: string | null;
  /** 레거시 주문(이전 UI). 신규는 무시하고 ribbon_message → rw_kyungjo, ribbon_card_message → rw_card */
  ribbon_message_kind?: string | null;
  /** 선택 — rw_card */
  ribbon_card_message?: string | null;
  venue_detail?: string | null;
};

export type NewrunOrderItemSlice = {
  quantity: number;
  /** 주문 스냅샷용 표시명 — Neuron `rw_menucode` 매핑에 사용하지 않음 */
  product_name: string;
};

export type NewrunIntranetCredentials = {
  rw_rosewebid: string;
  rw_rosewebpw: string;
  rw_assoc: string;
  /** 가이드 `rw_associd` — env `NEWRUN_RW_ASSOCID` */
  rw_associd: string;
  rw_returnurl: string;
};

export type NewrunMergedDrafts = {
  florist: Record<string, string> | null;
  product: Record<string, string> | null;
  option: Record<string, string> | null;
};

export type MapOrderToNewrunPayloadOptions = {
  rwSnoSource?: NewrunRwSnoSource;
  /** 배송방법 코드 — 협회·뉴런 문서 값 (미설정 시 1) */
  rw_method?: string;
  /** YYYYMMDD. 없으면 `order.created_at` 기준 KST 당일 — `headquartersBonbalju`이면 무시 */
  rw_bdate?: string;
  /** 기본 true. false면 검증 실패 시에도 필드는 채우고 `blockingIssues`로 반환(미리보기). */
  strict?: boolean;
  /**
   * 본부발주(head): `rw_type=head`, `rw_sender`·`rw_method` 고정, `rw_sno`=주문 UUID,
   * `rw_bdate`=희망배송일 YYYY-MM-DD, 수주화원·상품코드 필수 검증 생략
   */
  headquartersBonbalju?: boolean;
};

export type MapOrderToNewrunPayloadResult = {
  fields: Record<string, string>;
  warnings: string[];
  /** `strict: false`(미리보기)일 때만 채움 — 발주 전에 해결해야 할 검증 오류 */
  blockingIssues?: string[];
};

function pickFirst(draft: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = draft[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

function toIntWon(v: number | string): number {
  const n = typeof v === "string" ? parseFloat(String(v).replace(/,/g, "")) : v;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function normalizePhone(s: string): string {
  return String(s).replace(/\s/g, "").slice(0, 30);
}

function formatBdateFromIso(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    const x = new Date();
    return `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** 본부발주 스펙: 희망배송일 `YYYY-MM-DD`, 없으면 `created_at` 일자 */
export function formatRwBdateYmdDash(
  desired: string | null | undefined,
  createdIso: string | undefined
): string {
  const raw = desired?.trim();
  if (raw) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{8}$/.test(raw)) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  const d2 = createdIso ? new Date(createdIso) : new Date();
  if (Number.isNaN(d2.getTime())) {
    const x = new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }
  return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}-${String(d2.getDate()).padStart(2, "0")}`;
}

function truncateField(
  key: string,
  value: string,
  warnings: string[],
  limits: Record<string, number> = NEWRUN_RW_STRING_LIMITS
): string {
  const max = limits[key];
  if (max == null || value.length <= max) return value;
  warnings.push(`${key}: ${value.length}자 → ${max}자로 잘림`);
  return value.slice(0, max);
}

/** T4.5: 상세 주소·요청을 memo / rw_custreq(가이드)에 나눔 — `rw_shopreq` 필드는 사용하지 않음 */
export function splitShippingDetailForRw(
  shippingDetail: string | null | undefined,
  optionExtraLine: string | null | undefined
): { rw_memo: string; rw_custreq: string } {
  const detail = (shippingDetail ?? "").trim();
  const extra = (optionExtraLine ?? "").trim();
  const memoMax = NEWRUN_RW_STRING_LIMITS.rw_memo ?? 2000;
  const custMax = NEWRUN_RW_STRING_LIMITS.rw_custreq ?? 2000;

  let memo = detail;
  let cust = "";
  if (memo.length > memoMax) {
    cust = memo.slice(memoMax);
    memo = memo.slice(0, memoMax);
  }
  if (extra) {
    const combined = cust ? `${cust} | ${extra}` : extra;
    if (combined.length > custMax) {
      cust = combined.slice(0, custMax);
    } else {
      cust = combined;
    }
  }
  return { rw_memo: memo, rw_custreq: cust };
}

/** 슬롯 문자열에서 첫 `HH:MM` 추출 (예: 14:00~16:00 → 14:00) */
function pickRwBtimeFromDeliverySlot(slot: string | null | undefined): string {
  const s = (slot ?? "").trim();
  if (!s) return "";
  const m = s.match(/(\d{1,2}:\d{2})/);
  return m ? m[1]! : "";
}

function mergeRwPrefixedFromDraft(draft: Record<string, string>, target: Record<string, string>) {
  for (const [k, v] of Object.entries(draft)) {
    if (!k.startsWith("rw_") || v === "") continue;
    if (!isIntranetPostRwKey(k)) continue;
    target[k] = v;
  }
}

function applyFloristDraft(draft: Record<string, string>, target: Record<string, string>) {
  const sid = pickFirst(draft, ["rw_sujuid", "var_sid", "sujuid"]);
  if (sid) target.rw_sujuid = sid;
  mergeRwPrefixedFromDraft(draft, target);
}

function applyProductDraft(draft: Record<string, string>, target: Record<string, string>) {
  const menu = pickFirst(draft, [
    "rw_menucode",
    "menucode",
    "var_menucode",
    "var_mcode",
    "goodcode",
    "var_goodcode",
    "var_code",
    "good_code",
  ]);
  if (menu) target.rw_menucode = menu;
  const menuEtc = pickFirst(draft, ["rw_menu_etc", "rw_menuetc", "menu_etc", "var_menu_etc"]);
  if (menuEtc) target.rw_menu_etc = menuEtc;
  mergeRwPrefixedFromDraft(draft, target);
}

function optionDraftToLine(d: Record<string, string>): string {
  if (Object.keys(d).length === 0) return "";
  return Object.entries(d)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function requireEnvRoseWebId(): string {
  return process.env.NEWRUN_ROSEWEB_ID?.trim() ?? "";
}

function requireEnvReturnUrl(): string {
  return process.env.NEWRUN_RW_RETURNURL?.trim() ?? "";
}

/** intranet_post 키만 담긴 객체로 정규화(템플릿 순서 유지) */
function finalizeIntranetFields(f: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of INTRANET_POST_RW_KEYS) {
    out[k] = f[k] ?? "";
  }
  return out;
}

/**
 * 주문·품목·병합된 draft·인증값으로 intranet_post 폼 필드 생성.
 */
export function mapOrderToNewrunPayload(
  order: NewrunOrderSlice,
  items: NewrunOrderItemSlice[],
  drafts: NewrunMergedDrafts,
  creds: NewrunIntranetCredentials,
  options: MapOrderToNewrunPayloadOptions = {}
): MapOrderToNewrunPayloadResult {
  const warnings: string[] = [];
  const strict = options.strict ?? true;
  const hq = options.headquartersBonbalju === true;
  const rwSnoSource = options.rwSnoSource ?? "order_no";
  const rw_sno =
    hq
      ? String(order.id).trim().slice(0, 40)
      : rwSnoSource === "order_id"
        ? String(order.id).replace(/-/g, "").slice(0, 40)
        : String(order.order_no).trim().slice(0, 40);

  const arrive = [order.shipping_postcode ? `[${order.shipping_postcode}]` : "", order.shipping_address]
    .filter(Boolean)
    .join(" ")
    .trim();

  const optionLine = drafts.option ? optionDraftToLine(drafts.option) : "";
  const { rw_memo: memoFromDetail, rw_custreq: custFromDetail } = splitShippingDetailForRw(
    order.shipping_detail,
    optionLine || null
  );

  const fields = buildEmptyRwForm() as Record<string, string>;

  const envRose = requireEnvRoseWebId();
  const envReturn = requireEnvReturnUrl();

  fields.rw_sender = RW_SENDER_DEFAULT;
  fields.rw_style = RW_STYLE_DEFAULT;
  fields.rw_method = (options.rw_method ?? process.env.NEWRUN_DEFAULT_RW_METHOD ?? "1").trim();
  fields.rw_sno = rw_sno;
  fields.rw_returnurl = envReturn;
  fields.rw_rosewebid = envRose;
  fields.rw_rosewebpw = creds.rw_rosewebpw.trim();
  fields.rw_assoc = creds.rw_assoc.trim();
  fields.rw_associd = creds.rw_associd.trim();
  fields.rw_sendsms = RW_SMS_DEFAULT;
  fields.rw_sendfax = RW_FAX_DEFAULT;
  fields.rw_price = String(toIntWon(order.total_amount));
  fields.rw_aname = truncateField("rw_aname", order.shipping_name.trim(), warnings);
  fields.rw_atel = truncateField("rw_atel", normalizePhone(order.shipping_phone), warnings);
  fields.rw_arrive_place1 = truncateField("rw_arrive_place1", arrive, warnings);
  fields.rw_bdate = hq
    ? formatRwBdateYmdDash(order.desired_delivery_date, order.created_at)
    : options.rw_bdate?.trim() || formatBdateFromIso(order.created_at);
  const slotBtime = pickRwBtimeFromDeliverySlot(order.delivery_time_slot);
  const envDefaultBtime = (process.env.NEWRUN_DEFAULT_RW_BTIME ?? "").trim();
  fields.rw_btime = (fields.rw_btime?.trim() || slotBtime || envDefaultBtime || "").trim();
  fields.rw_memo = truncateField("rw_memo", memoFromDetail, warnings);
  fields.rw_custreq = truncateField("rw_custreq", custFromDetail, warnings);

  if (hq) {
    fields.rw_type = "head";
    fields.rw_sender = "100";
    fields.rw_method = "1";
    fields.rw_sno = truncateField("rw_sno", String(order.id).trim(), warnings);
  }

  if (drafts.florist && Object.keys(drafts.florist).length > 0) {
    applyFloristDraft(drafts.florist, fields);
  }
  if (drafts.product && Object.keys(drafts.product).length > 0) {
    applyProductDraft(drafts.product, fields);
  }

  /** 운영 고정 수주화원 — 설정 시 협회 draft보다 우선(예: NEWRUN_DEFAULT_RW_SUJUID=kot4545) */
  const forcedSujuid = (process.env.NEWRUN_DEFAULT_RW_SUJUID ?? "").trim();
  if (forcedSujuid) {
    fields.rw_sujuid = truncateField("rw_sujuid", forcedSujuid, warnings);
  }

  const slotBtimeAfterDrafts = pickRwBtimeFromDeliverySlot(order.delivery_time_slot);
  const envDefaultBtimeAfter = (process.env.NEWRUN_DEFAULT_RW_BTIME ?? "").trim();
  if (!fields.rw_btime.trim()) {
    fields.rw_btime = (slotBtimeAfterDrafts || envDefaultBtimeAfter || "").trim();
  }

  const detailPlaceSource =
    (order.venue_detail ?? "").trim() ||
    extractFloristVenueLineFromShippingDetail(order.shipping_detail);
  if (detailPlaceSource) {
    fields.rw_arrive_place2 = truncateField("rw_arrive_place2", detailPlaceSource, warnings);
  }

  const rs = (order.ribbon_sender ?? "").trim();
  const rm = (order.ribbon_message ?? "").trim();
  const cm = (order.ribbon_card_message ?? "").trim();
  /** 레거시: ribbon_message_kind=card 는 과거 UI에서 rw_card만 쓴 주문 */
  const legacyKind = (order.ribbon_message_kind ?? "").trim().toLowerCase();
  const legacyCardOnly = legacyKind === "card" || legacyKind === "card_only";

  fields.rw_sendpeople = truncateField(
    "rw_sendpeople",
    rs || NEWRUN_DEFAULT_SENDPEOPLE,
    warnings
  );

  fields.rw_kyungjo = "";
  fields.rw_card = "";
  if (legacyCardOnly) {
    if (rm) fields.rw_card = truncateField("rw_card", rm, warnings);
  } else {
    if (rm) fields.rw_kyungjo = truncateField("rw_kyungjo", rm, warnings);
    if (cm) fields.rw_card = truncateField("rw_card", cm, warnings);
  }

  const jn = (order.orderer_name ?? "").trim();
  if (jn) fields.rw_jname = truncateField("rw_jname", jn, warnings);

  if (items.length > 0) {
    const q = Math.max(1, Math.floor(Number(items[0]!.quantity)) || 1);
    fields.rw_qty = String(q);
  }
  if (!fields.rw_qty.trim()) {
    fields.rw_qty = "1";
  }

  const menuFromDraft = fields.rw_menucode?.trim() ?? "";
  fields.rw_menucode = menuFromDraft
    ? truncateField("rw_menucode", menuFromDraft, warnings)
    : "";

  const truncateKeys: IntranetPostRwKey[] = [
    "rw_sujuid",
    "rw_menucode",
    "rw_menu_etc",
    "rw_sno",
    "rw_aname",
    "rw_atel",
    "rw_ahandtel",
    "rw_jname",
    "rw_jtel",
    "rw_jhandtel",
    "rw_arrive_place1",
    "rw_arrive_place2",
    "rw_memo",
    "rw_custreq",
    "rw_shopreq1",
    "rw_shopreq2",
    "rw_returnurl",
    "rw_sendpeople",
    "rw_kyungjo",
    "rw_card",
    "rw_associd",
  ];
  for (const k of truncateKeys) {
    if (fields[k]) fields[k] = truncateField(k, fields[k], warnings);
  }

  const issues: string[] = [];
  if (!fields.rw_rosewebid.trim()) issues.push("rw_rosewebid 비어 있음 — NEWRUN_ROSEWEB_ID 필수");
  if (!creds.rw_rosewebpw.trim()) issues.push("rw_rosewebpw 비어 있음");
  if (!fields.rw_assoc.trim()) issues.push("rw_assoc 비어 있음");
  if (!fields.rw_returnurl.trim()) issues.push("rw_returnurl 비어 있음 — NEWRUN_RW_RETURNURL 필수");
  if (strict) {
    if (!fields.rw_menucode?.trim()) {
      issues.push(
        "상품코드(rw_menucode) 없음 — 상품 newrun_default_product_draft(또는 주문 병합 draft)에 rw_menucode 필수"
      );
    }
    if (!fields.rw_sujuid?.trim()) {
      issues.push(
        "수주화원(rw_sujuid) 없음 — 거래처 clients.newrun_default_florist_draft 또는 주문 newrun_florist_draft에 rw_sujuid/var_sid 필요"
      );
    }
    if (order.payment_status !== "paid") {
      issues.push(`결제완료(payment_status=paid)만 발주 권장 — 현재: ${order.payment_status}`);
    }
  }

  const normalized = finalizeIntranetFields(fields);

  if (issues.length > 0) {
    if (strict) throw new NewrunPayloadValidationError(issues);
    return { fields: normalized, warnings, blockingIssues: issues };
  }

  return { fields: normalized, warnings };
}

/**
 * 디버그·로컬 테스트용 UTF-8 URLSearchParams (실제 발주는 `encodeNewrunIntranetPostBody` + EUC-KR).
 */
export function newrunFieldsToSearchParams(fields: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    p.set(k, v);
  }
  return p;
}

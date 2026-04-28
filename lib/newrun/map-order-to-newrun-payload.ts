/**
 * 뉴런 intranet_post용 `rw_*` 폼 필드 매핑 (문서 2.1.3 / Phase 4).
 * 협회·콜백 키는 현장마다 다를 수 있어, 알려진 별칭을 우선하고 `rw_` 접두어 키는 그대로 통과시킨다.
 */

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
const RW_SMS_DEFAULT = "0";
const RW_FAX_DEFAULT = "0";

/**
 * 축하3단 — 상품↔뉴런 매핑 전 발주 E2E/테스트용 고정 상품 코드.
 * 실매핑 도입 시 제거하거나 env 기본값으로 대체.
 */
export const NEWRUN_FIXED_RW_MENUCODE = "35";

/** 문자열 필드 상한(보수적). 뉴런 문서·실측에 맞춰 조정 가능. */
export const NEWRUN_RW_STRING_LIMITS: Record<string, number> = {
  rw_aname: 50,
  rw_atel: 30,
  rw_arrive_place1: 255,
  rw_memo: 500,
  rw_shopreq: 500,
  rw_sno: 40,
  rw_menucode: 80,
  rw_sujuid: 80,
  rw_jname: 50,
  detailPlace: 500,
  ribbonSender: 100,
  ribbonMessage: 500,
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
  orderer_name?: string | null;
  ribbon_sender?: string | null;
  ribbon_message?: string | null;
  venue_detail?: string | null;
};

export type NewrunOrderItemSlice = {
  quantity: number;
  product_name: string;
};

export type NewrunIntranetCredentials = {
  rw_rosewebid: string;
  rw_rosewebpw: string;
  rw_assoc: string;
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

/** T4.5: 상세 주소·요청을 memo / shopreq에 나눔 */
export function splitShippingDetailForRw(
  shippingDetail: string | null | undefined,
  optionExtraLine: string | null | undefined
): { rw_memo: string; rw_shopreq: string } {
  const detail = (shippingDetail ?? "").trim();
  const extra = (optionExtraLine ?? "").trim();
  const memoMax = NEWRUN_RW_STRING_LIMITS.rw_memo ?? 500;
  const shopMax = NEWRUN_RW_STRING_LIMITS.rw_shopreq ?? 500;

  let memo = detail;
  let shop = "";
  if (memo.length > memoMax) {
    shop = memo.slice(memoMax);
    memo = memo.slice(0, memoMax);
  }
  if (extra) {
    const combined = shop ? `${shop} | ${extra}` : extra;
    if (combined.length > shopMax) {
      shop = combined.slice(0, shopMax);
    } else {
      shop = combined;
    }
  }
  return { rw_memo: memo, rw_shopreq: shop };
}

function mergeRwPrefixedFromDraft(draft: Record<string, string>, target: Record<string, string>) {
  for (const [k, v] of Object.entries(draft)) {
    if (!k.startsWith("rw_") || v === "") continue;
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
    "goodcode",
    "var_goodcode",
    "var_code",
    "good_code",
  ]);
  if (menu) target.rw_menucode = menu;
  mergeRwPrefixedFromDraft(draft, target);
}

function optionDraftToLine(d: Record<string, string>): string {
  if (Object.keys(d).length === 0) return "";
  return Object.entries(d)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
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
  const { rw_memo: memoFromDetail, rw_shopreq: shopFromDetail } = splitShippingDetailForRw(
    order.shipping_detail,
    optionLine || null
  );

  const fields: Record<string, string> = {
    rw_sender: RW_SENDER_DEFAULT,
    rw_style: RW_STYLE_DEFAULT,
    rw_method: (options.rw_method ?? process.env.NEWRUN_DEFAULT_RW_METHOD ?? "1").trim(),
    rw_sno,
    rw_returnurl: creds.rw_returnurl.trim(),
    rw_rosewebid: creds.rw_rosewebid.trim(),
    rw_rosewebpw: creds.rw_rosewebpw.trim(),
    rw_assoc: creds.rw_assoc.trim(),
    rw_sendsms: RW_SMS_DEFAULT,
    rw_sendfax: RW_FAX_DEFAULT,
    rw_price: String(toIntWon(order.total_amount)),
    rw_aname: truncateField("rw_aname", order.shipping_name.trim(), warnings),
    rw_atel: truncateField("rw_atel", normalizePhone(order.shipping_phone), warnings),
    rw_arrive_place1: truncateField("rw_arrive_place1", arrive, warnings),
    rw_bdate: hq
      ? formatRwBdateYmdDash(order.desired_delivery_date, order.created_at)
      : options.rw_bdate?.trim() || formatBdateFromIso(order.created_at),
    rw_memo: truncateField("rw_memo", memoFromDetail, warnings),
    rw_shopreq: truncateField("rw_shopreq", shopFromDetail, warnings),
  };

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

  const detailPlaceSource =
    (order.venue_detail ?? "").trim() ||
    extractFloristVenueLineFromShippingDetail(order.shipping_detail);
  if (detailPlaceSource) {
    fields.detailPlace = truncateField("detailPlace", detailPlaceSource, warnings);
  }

  const rs = (order.ribbon_sender ?? "").trim();
  const rm = (order.ribbon_message ?? "").trim();
  if (rs) fields.ribbonSender = truncateField("ribbonSender", rs, warnings);
  if (rm) fields.ribbonMessage = truncateField("ribbonMessage", rm, warnings);

  const jn = (order.orderer_name ?? "").trim();
  if (jn) fields.rw_jname = truncateField("rw_jname", jn, warnings);

  const truncateKeys = [
    "rw_sujuid",
    "rw_menucode",
    "rw_sno",
    "rw_aname",
    "rw_atel",
    "rw_jname",
    "rw_arrive_place1",
    "rw_memo",
    "rw_shopreq",
    "rw_returnurl",
    "detailPlace",
    "ribbonSender",
    "ribbonMessage",
  ] as const;
  for (const k of truncateKeys) {
    if (fields[k]) fields[k] = truncateField(k, fields[k], warnings);
  }

  fields.rw_menucode = truncateField("rw_menucode", NEWRUN_FIXED_RW_MENUCODE, warnings);

  const issues: string[] = [];
  if (!creds.rw_rosewebid.trim()) issues.push("rw_rosewebid 비어 있음");
  if (!creds.rw_rosewebpw.trim()) issues.push("rw_rosewebpw 비어 있음");
  if (!creds.rw_assoc.trim()) issues.push("rw_assoc 비어 있음");
  if (!creds.rw_returnurl.trim()) issues.push("rw_returnurl 비어 있음");
  if (strict) {
    if (!hq) {
      if (!fields.rw_sujuid?.trim()) {
        issues.push("수주화원(rw_sujuid) 없음 — 협회 검색 또는 거래처 기본 필요");
      }
      if (!fields.rw_menucode?.trim()) {
        issues.push("상품코드(rw_menucode) 없음 — 상품 검색·기본 또는 rw_menucode 필요");
      }
    }
    if (order.payment_status !== "paid") {
      issues.push(`결제완료(payment_status=paid)만 발주 권장 — 현재: ${order.payment_status}`);
    }
  }

  if (issues.length > 0) {
    if (strict) throw new NewrunPayloadValidationError(issues);
    return { fields, warnings, blockingIssues: issues };
  }

  return { fields, warnings };
}

/** Phase 5에서 application/x-www-form-urlencoded 생성 시 사용 */
export function newrunFieldsToSearchParams(fields: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    p.set(k, v);
  }
  return p;
}

import { appendNewrunPoReturnTokenToReturnUrl } from "@/lib/newrun/po-return-signing";
import {
  INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS,
  INTEGRATION_INTRANET_POST_TEST_BTIME,
  INTRANET_POST_TEST_CREDENTIAL_KEYS,
  type IntranetPostTestCredentialPatch,
} from "@/lib/newrun/intranet-post-integration-test-constants";
import {
  mapOrderToNewrunPayload,
  NEWRUN_RW_STRING_LIMITS,
  type NewrunIntranetCredentials,
  type NewrunMergedDrafts,
  type NewrunOrderItemSlice,
  type NewrunOrderSlice,
} from "@/lib/newrun/map-order-to-newrun-payload";
import { getNewrunCredentialsFromEnv } from "@/lib/newrun/submit-order";

export {
  INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS,
  INTRANET_POST_TEST_CREDENTIAL_KEYS,
  type IntranetPostTestCredentialKey,
  type IntranetPostTestCredentialPatch,
} from "@/lib/newrun/intranet-post-integration-test-constants";

/** 사전 테스트 화면·API에서 공통으로 쓰는 가짜 주문번호(실 주문 DB와 무관) */
export const INTEGRATION_INTRANET_POST_TEST_ORDER_NO = "CALLLINK-INTRANET-TEST";

/** 하위 호환·문서용 — 샘플 수주 ID (`NEWRUN_INTEGRATION_TEST_SUJUID`는 사전 테스트 Payload에 더 이상 반영되지 않음) */
export const INTEGRATION_INTRANET_POST_DEFAULT_SUJUID = INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS.rw_sujuid;

/**
 * Asia/Seoul 달력 기준 `from` 날짜에 `deltaDays`를 더한 YYYY-MM-DD (사전 테스트 배달일 D+N).
 */
export function seoulCalendarPlusDaysYmd(deltaDays: number, from: Date = new Date()): string {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(from);
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function sampleOrder(overrides?: Partial<NewrunOrderSlice>): NewrunOrderSlice {
  const id = "00000000-0000-4000-8000-00000000ab7e";
  return {
    id,
    order_no: INTEGRATION_INTRANET_POST_TEST_ORDER_NO,
    payment_status: "pending",
    total_amount: 1000,
    shipping_name: "발주연동테스트(샘플)",
    shipping_phone: "010-0000-0000",
    shipping_postcode: "06236",
    shipping_address: "서울 강남구 테헤란로 152",
    shipping_detail: "[사전테스트] 결제 없이 송신하는 샘플입니다. 실운영 발주와 무관합니다.",
    created_at: new Date().toISOString(),
    desired_delivery_date: seoulCalendarPlusDaysYmd(1),
    orderer_name: "테스트주문자",
    ribbon_sender: "테스트 리본 보냄",
    ribbon_message: "사전연동축하",
    venue_detail: "로비 사전테스트 장소",
    ...overrides,
  };
}

function sampleItems(): NewrunOrderItemSlice[] {
  return [{ quantity: 1, product_name: "샘플화환(사전테스트)" }];
}

function sampleDrafts(): NewrunMergedDrafts {
  const sujuid = INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS.rw_sujuid;
  return {
    florist: { rw_sujuid: sujuid, var_sid: sujuid },
    product: {
      rw_menucode: "09",
      var_mcode: "09",
      var_mname: "근조화환(기본형)",
    },
    option: null,
  };
}

function fallbackCreds(): NewrunIntranetCredentials {
  return {
    rw_rosewebid: "",
    rw_rosewebpw: "",
    rw_assoc: "",
    rw_associd: "",
    rw_returnurl: "",
  };
}

export type IntegrationIntranetPostSampleResult = {
  fields: Record<string, string>;
  warnings: string[];
  blockingIssues: string[];
};

/** intranet_post 샘플 Payload에만 적용(env·draft와 무관) */
function applyIntegrationIntranetPostFixedIds(fields: Record<string, string>): Record<string, string> {
  const f = { ...fields };
  const x = INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS;
  f.rw_rosewebid = x.rw_rosewebid;
  f.rw_rosewebpw = x.rw_rosewebpw;
  f.rw_assoc = x.rw_assoc;
  f.rw_associd = x.rw_associd;
  f.rw_sujuid = x.rw_sujuid;
  return f;
}

/** 뉴런 배달일시(코드 11·12·zz_221 등) 회피 — 서울 기준 익일 + 고정 시각 */
function applyIntegrationIntranetPostTestDeliveryDateTime(fields: Record<string, string>): Record<string, string> {
  const f = { ...fields };
  f.rw_bdate = seoulCalendarPlusDaysYmd(1);
  f.rw_btime = INTEGRATION_INTRANET_POST_TEST_BTIME;
  return f;
}

/** 샘플 Payload의 고정 5필드를 화면/API에서 전달한 값으로 덮어씁니다(문자열 상한 적용). */
export function mergeIntranetPostTestCredentials(
  base: Record<string, string>,
  patch: IntranetPostTestCredentialPatch | null | undefined
): Record<string, string> {
  if (patch == null || typeof patch !== "object") return { ...base };
  const out = { ...base };
  for (const key of INTRANET_POST_TEST_CREDENTIAL_KEYS) {
    const v = patch[key];
    if (v === undefined || v === null) continue;
    const trimmed = String(v).trim();
    const max = NEWRUN_RW_STRING_LIMITS[key];
    out[key] = max != null && trimmed.length > max ? trimmed.slice(0, max) : trimmed;
  }
  return out;
}

/**
 * 결제·DB 없이 intranet_post와 동일 규칙으로 필드 생성(미리보기·테스트 POST 공통).
 * `strict: false` — 결제 미완료 등은 blockingIssues로만 표시.
 * 인증·협회·수주 ID 5개는 기본적으로 `INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS`와 동일하게 맞추고,
 * `mergeIntranetPostTestCredentials`로 API/화면 입력을 합칠 수 있습니다.
 * 배달일·시각은 서울 기준 익일(`rw_bdate`)·`INTEGRATION_INTRANET_POST_TEST_BTIME`(오후 2시)로 맞춥니다.
 */
export function buildIntegrationIntranetPostSampleFields(): IntegrationIntranetPostSampleResult {
  const creds = getNewrunCredentialsFromEnv() ?? fallbackCreds();
  const { fields, warnings, blockingIssues } = mapOrderToNewrunPayload(
    sampleOrder(),
    sampleItems(),
    sampleDrafts(),
    creds,
    {
      strict: false,
      headquartersBonbalju: true,
      rw_method: "1",
    }
  );

  const fieldsFixed = applyIntegrationIntranetPostFixedIds(fields);
  const withDelivery = applyIntegrationIntranetPostTestDeliveryDateTime(fieldsFixed);

  const signedReturn = appendNewrunPoReturnTokenToReturnUrl(
    withDelivery.rw_returnurl,
    withDelivery.rw_sno.trim()
  );
  return {
    fields: { ...withDelivery, rw_returnurl: signedReturn },
    warnings,
    blockingIssues: blockingIssues ?? [],
  };
}

export function maskIntranetPostFieldsForClient(fields: Record<string, string>): Record<string, string> {
  const out = { ...fields };
  if (out.rw_rosewebpw) out.rw_rosewebpw = out.rw_rosewebpw.trim() ? "***" : "";
  return out;
}

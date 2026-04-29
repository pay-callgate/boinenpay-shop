import { appendNewrunPoReturnTokenToReturnUrl } from "@/lib/newrun/po-return-signing";
import {
  mapOrderToNewrunPayload,
  type NewrunIntranetCredentials,
  type NewrunMergedDrafts,
  type NewrunOrderItemSlice,
  type NewrunOrderSlice,
} from "@/lib/newrun/map-order-to-newrun-payload";
import { getNewrunCredentialsFromEnv } from "@/lib/newrun/submit-order";

/** 사전 테스트 화면·API에서 공통으로 쓰는 가짜 주문번호(실 주문 DB와 무관) */
export const INTEGRATION_INTRANET_POST_TEST_ORDER_NO = "CALLLINK-INTRANET-TEST";

/** 샘플 `rw_sujuid` — `NEWRUN_INTEGRATION_TEST_SUJUID`로 덮어쓸 수 있음 */
export const INTEGRATION_INTRANET_POST_DEFAULT_SUJUID = "sinil275";

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
    desired_delivery_date: "2026-12-31",
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
  const sujuid =
    process.env.NEWRUN_INTEGRATION_TEST_SUJUID?.trim() || INTEGRATION_INTRANET_POST_DEFAULT_SUJUID;
  return {
    florist: { rw_sujuid: sujuid, var_sid: sujuid },
    product: { rw_menucode: "43" },
    option: null,
  };
}

function fallbackCreds(): NewrunIntranetCredentials {
  return {
    rw_rosewebid: "",
    rw_rosewebpw: "",
    rw_assoc: "",
    rw_returnurl: "",
  };
}

export type IntegrationIntranetPostSampleResult = {
  fields: Record<string, string>;
  warnings: string[];
  blockingIssues: string[];
};

/**
 * 결제·DB 없이 intranet_post와 동일 규칙으로 필드 생성(미리보기·테스트 POST 공통).
 * `strict: false` — 결제 미완료 등은 blockingIssues로만 표시.
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

  const signedReturn = appendNewrunPoReturnTokenToReturnUrl(
    fields.rw_returnurl,
    fields.rw_sno.trim()
  );
  return {
    fields: { ...fields, rw_returnurl: signedReturn },
    warnings,
    blockingIssues: blockingIssues ?? [],
  };
}

export function maskIntranetPostFieldsForClient(fields: Record<string, string>): Record<string, string> {
  const out = { ...fields };
  if (out.rw_rosewebpw) out.rw_rosewebpw = out.rw_rosewebpw.trim() ? "***" : "";
  return out;
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Case2 템플릿 코드 기본값 — `.env`의 `MSGAGENT_TEMPLATE_C2` 미설정 시에만 사용.
 */
export const MSGAGENT_TEMPLATE_CODE_WITH_CALLLINK_070 = "CLSP00002";

/** Case1 — 링크만 (환경: `MSGAGENT_TEMPLATE_CODE_C1`, 폴백 `MSGAGENT_TEMPLATE_CODE`) */
export const KAKAO_ALIMTALK_LINK_TEMPLATE_CASE1 = `안녕하세요.

화면으로 바로 주문하는
#{storeName} 콜링크 쇼핑입니다.

요청하신 서비스 이용을 위해 아래의 링크를 눌러 접속해 주세요.
#{url}

감사합니다.`;

/** Case2 — 070 + 링크 (환경: `MSGAGENT_TEMPLATE_C2`) */
export const KAKAO_ALIMTALK_LINK_TEMPLATE_CASE2 = `안녕하세요.

화면으로 바로 주문하는
#{storeName} 콜링크 쇼핑입니다.

요청하신 서비스 이용을 위해 
아래의 전화번호 또는 링크를 눌러 접속해 주세요.

- 대표 번호 : #{CallLinkNum}
- 주문 링크 : #{url}

감사합니다.`;

export type LinkKakaoAlimtalkCase = "case1" | "case2";

import { formatCallLinkPhoneDisplay } from "@/lib/format-call-link-phone";

/**
 * 070·050 등 CallLink 연동 번호 표기 (예: 070-4504-4182, 0508-2793-5382)
 */
export function formatAlimtalk070Display(raw: string): string {
  return formatCallLinkPhoneDisplay(raw);
}

export function resolveLinkAlimtalkMessage(params: {
  storeName: string;
  orderUrl: string;
  /** 하이픈 포함(070-4504-4182). 비어 있으면 Case1 */
  callLinkNumFormatted?: string;
}): string {
  const name = params.storeName?.trim() || "파트너";
  const url = params.orderUrl?.trim() || "(링크 준비 중)";
  const call = params.callLinkNumFormatted?.trim();
  if (call) {
    return KAKAO_ALIMTALK_LINK_TEMPLATE_CASE2.replace(/#\{storeName\}/g, name)
      .replace(/#\{CallLinkNum\}/g, call)
      .replace(/#\{url\}/g, url);
  }
  return KAKAO_ALIMTALK_LINK_TEMPLATE_CASE1.replace(/#\{storeName\}/g, name).replace(
    /#\{url\}/g,
    url
  );
}

/** Case1: `MSGAGENT_TEMPLATE_CODE_C1` → 없으면 레거시 `MSGAGENT_TEMPLATE_CODE` */
export function getMsgagentTemplateCodeCase1(): string {
  return (
    process.env.MSGAGENT_TEMPLATE_CODE_C1?.trim() ||
    process.env.MSGAGENT_TEMPLATE_CODE?.trim() ||
    ""
  );
}

/** Case2: `MSGAGENT_TEMPLATE_C2` → 없으면 코드 기본값(CLSP00002) */
export function getMsgagentTemplateCodeCase2(): string {
  return (
    process.env.MSGAGENT_TEMPLATE_C2?.trim() ||
    MSGAGENT_TEMPLATE_CODE_WITH_CALLLINK_070
  );
}

export function getMsgagentTemplateCodeForLinkKakao(
  case_: LinkKakaoAlimtalkCase
): string {
  if (case_ === "case2") {
    return getMsgagentTemplateCodeCase2();
  }
  return getMsgagentTemplateCodeCase1();
}

/**
 * DB 기준 Case 분기: clients.call_070_connected 이고 070 번호가 있을 때만 Case2.
 */
export async function resolveLinkKakaoAlimtalkCase(
  supabase: SupabaseClient,
  clientId: string
): Promise<LinkKakaoAlimtalkCase> {
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("call_070_connected")
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client?.call_070_connected) {
    return "case1";
  }

  const { data: cfg } = await supabase
    .from("client_call_070_configs")
    .select("call_070_number")
    .eq("client_id", clientId)
    .maybeSingle();

  const digits = String(cfg?.call_070_number ?? "").replace(/\D/g, "");
  if (!digits || digits.length < 9) {
    return "case1";
  }

  return "case2";
}

/**
 * 파트너 관리자 > 뉴런 intranet_post 사전 테스트용 인증·협회·수주 ID.
 * 클라이언트·서버 공통 — 폼 기본값과 credentialDefaults에 동일하게 사용합니다.
 */
export const INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS = {
  rw_rosewebid: "kot4545",
  rw_rosewebpw: "9l8uqs",
  rw_assoc: "kot45",
  rw_associd: "call0000",
  rw_sujuid: "kot4545",
} as const;

/** intranet_post 사전 테스트 — 배달 시각(뉴런 연동 가이드 흔한 형식: 24시 표기 오후 2시) */
export const INTEGRATION_INTRANET_POST_TEST_BTIME = "14:00";

export const INTRANET_POST_TEST_CREDENTIAL_KEYS = [
  "rw_rosewebid",
  "rw_rosewebpw",
  "rw_assoc",
  "rw_associd",
  "rw_sujuid",
] as const;

export type IntranetPostTestCredentialKey = (typeof INTRANET_POST_TEST_CREDENTIAL_KEYS)[number];

export type IntranetPostTestCredentialPatch = Partial<
  Record<IntranetPostTestCredentialKey, string>
>;

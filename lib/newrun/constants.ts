/**
 * 뉴런 연동 — `var_ret` 절대 URL 조립 시 사용하는 앱 내 경로 (Phase 2에서 Route Handler 구현)
 */
export const NEWRUN_CALLBACK_PATHS = {
  florist: "/api/integrations/newrun/callback/florist",
  product: "/api/integrations/newrun/callback/product",
  option: "/api/integrations/newrun/callback/option",
} as const;

export type NewrunCallbackKind = keyof typeof NEWRUN_CALLBACK_PATHS;

import type { NewrunCallbackKind } from "@/lib/newrun/constants";

/** Supabase `orders` 테이블 컬럼명 — kind별 발주 초안 JSONB */
export const NEWRUN_ORDER_DRAFT_COLUMNS: Record<NewrunCallbackKind, string> = {
  florist: "newrun_florist_draft",
  product: "newrun_product_draft",
  option: "newrun_option_draft",
};

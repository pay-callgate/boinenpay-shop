/**
 * 파트너 어드민 주문 목록·엑셀용 뉴런 발주 상태 표시 (Phase 8.1)
 */

export type NewrunSubmitListFilter =
  | "all"
  | "not_sent"
  | "ok"
  | "failed"
  | "needs_attention";

export type OrderNewrunListFields = {
  payment_status: string;
  newrun_submit_status?: string | null;
  newrun_rwr_result?: string | null;
};

/** 목록·엑셀 셀 문구 */
export function formatAdminNewrunSubmitLabel(order: OrderNewrunListFields): string {
  if (order.payment_status !== "paid") {
    return "—";
  }
  const s = order.newrun_submit_status?.trim() ?? "";
  if (!s) return "미전송";
  if (s === "success") return "전송완료";
  if (s === "duplicate") return "전송완료(중복)";
  if (s === "failed") {
    const r = order.newrun_rwr_result?.trim();
    return r ? `실패(${r})` : "실패";
  }
  if (s === "skipped") return "확인필요";
  return s;
}

/** Tailwind 배지 클래스 (배경 + 글자) */
export function adminNewrunSubmitBadgeClass(order: OrderNewrunListFields): string {
  if (order.payment_status !== "paid") {
    return "bg-slate-100 text-slate-600";
  }
  const s = order.newrun_submit_status?.trim() ?? "";
  if (!s) return "bg-amber-50 text-amber-900";
  if (s === "success" || s === "duplicate") return "bg-emerald-50 text-emerald-900";
  if (s === "failed") return "bg-red-50 text-red-900";
  if (s === "skipped") return "bg-orange-50 text-orange-950";
  return "bg-slate-100 text-slate-800";
}

export function truncateNewrunOrderKey(key: string | null | undefined, max = 12): string {
  if (key == null || key === "") return "—";
  const t = key.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

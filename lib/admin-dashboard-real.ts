/**
 * 실운영 어드민 대시보드 — KST 기준 일자·집계 헬퍼
 */

export function getKstYmd(d: Date): string {
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const day = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function kstDayStartUtcIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00+09:00`).toISOString();
}

export function kstDayEndUtcIso(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999+09:00`).toISOString();
}

/** KST 기준 오늘 00:00 ~ 내일 00:00 (UTC ISO) 구간 — DB timestamptz 비교용 */
export function kstTodayRangeUtc(): { startIso: string; endIso: string; ymd: string } {
  const ymd = getKstYmd(new Date());
  return {
    ymd,
    startIso: kstDayStartUtcIso(ymd),
    endIso: kstDayEndUtcIso(ymd),
  };
}

/** i=0 → 6일 전, i=6 → 오늘 (KST) */
export function kstDayYmdOffsetFromToday(offsetDays: number): string {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kst.setDate(kst.getDate() + offsetDays);
  return getKstYmd(kst);
}

export const ADMIN_ORDER_STATUS_LABEL: Record<string, string> = {
  received: "접수",
  confirmed: "주문확정",
  pending_payment: "입금대기",
  paid: "결제완료",
  preparing: "배송준비중",
  shipping: "배송중",
  delivered: "배송완료",
  cancelled: "취소됨",
};

export const ADMIN_PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  refunded: "환불됨",
};

export function dashboardRecentOrderStatusLabel(
  status: string,
  paymentStatus: string
): string {
  if (paymentStatus === "paid") {
    return ADMIN_ORDER_STATUS_LABEL[status] ?? status;
  }
  return ADMIN_PAYMENT_STATUS_LABEL[paymentStatus] ?? paymentStatus;
}

/** 목록 배지 톤 (주문 페이지와 유사) */
export function dashboardStatusBadgeStyle(
  status: string,
  paymentStatus: string
): { statusColor: string; dotColor: string } {
  if (paymentStatus !== "paid") {
    if (paymentStatus === "pending") {
      return {
        statusColor: "bg-amber-50 text-amber-700",
        dotColor: "bg-amber-500",
      };
    }
    if (paymentStatus === "failed") {
      return {
        statusColor: "bg-red-50 text-red-700",
        dotColor: "bg-red-500",
      };
    }
    return {
      statusColor: "bg-slate-100 text-slate-700",
      dotColor: "bg-slate-500",
    };
  }
  switch (status) {
    case "delivered":
      return {
        statusColor: "bg-emerald-50 text-emerald-700",
        dotColor: "bg-emerald-500",
      };
    case "shipping":
      return {
        statusColor: "bg-blue-50 text-blue-700",
        dotColor: "bg-blue-500",
      };
    case "preparing":
      return {
        statusColor: "bg-violet-50 text-violet-700",
        dotColor: "bg-violet-500",
      };
    case "cancelled":
      return {
        statusColor: "bg-red-50 text-red-700",
        dotColor: "bg-red-500",
      };
    default:
      return {
        statusColor: "bg-slate-50 text-slate-700",
        dotColor: "bg-slate-500",
      };
  }
}

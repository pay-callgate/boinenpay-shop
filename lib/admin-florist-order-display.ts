/**
 * 파트너 어드민 — 화훼 희망 배송일·리본 표시 공통
 */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 브라우저 로컬 기준 오늘 YYYY-MM-DD */
export function getAdminLocalTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** API/DB에서 온 날짜 → YYYY-MM-DD (DATE 또는 ISO) */
export function toDesiredDeliveryYmd(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim();
  if (YMD_RE.test(s)) return s;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isDesiredDeliveryToday(
  desiredYmd: string | null | undefined,
  todayYmd: string = getAdminLocalTodayYmd()
): boolean {
  if (!desiredYmd) return false;
  const n = toDesiredDeliveryYmd(desiredYmd);
  return n === todayYmd;
}

/** 목록·배송 테이블용 한 줄 */
export function formatDesiredDeliveryDateTimeLine(
  desiredDate: string | null | undefined,
  timeSlot: string | null | undefined
): string {
  const ymd = toDesiredDeliveryYmd(desiredDate ?? null);
  const datePart = ymd
    ? ymd.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, d) => `${y}.${m}.${d}`)
    : "";
  const slot = typeof timeSlot === "string" && timeSlot.trim() ? timeSlot.trim() : "";
  if (datePart && slot) return `${datePart} · ${slot}`;
  if (datePart) return datePart;
  if (slot) return slot;
  return "—";
}

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  parcel: "택배",
  quick: "퀵배송",
};

export function formatAdminDeliveryMethod(method: string | null | undefined): string {
  if (method == null || String(method).trim() === "") return "—";
  const k = String(method).trim();
  return DELIVERY_METHOD_LABELS[k] ?? k;
}

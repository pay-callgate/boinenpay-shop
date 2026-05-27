/** 쇼핑몰 배달 희망일 — Asia/Seoul 달력 기준 YYYY-MM-DD */

export function getSeoulTodayYmd(from: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(from);
}

export function getSeoulTomorrowYmd(from: Date = new Date()): string {
  const ymd = getSeoulTodayYmd(from);
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const shifted = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** 배달일이 서울 기준 오늘보다 이전이면 true */
export function isDeliveryDateInPast(deliveryDate: string): boolean {
  const s = deliveryDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  return s < getSeoulTodayYmd();
}

/** 과거면 오늘(서울)로 보정 */
export function clampDeliveryDateYmd(deliveryDate: string): string {
  const s = deliveryDate.trim();
  if (!s || isDeliveryDateInPast(s)) return getSeoulTodayYmd();
  return s;
}

/** 비회원 주문조회 입력·DB 매칭용 정규화 */

export function normalizeGuestOrderNo(raw: string): string {
  return String(raw ?? "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

export function normalizeGuestOrdererName(raw: string): string {
  return String(raw ?? "")
    .trim()
    .normalize("NFC");
}

/** 주문자명 일치 — orderer_name 우선, 과거 호환 shipping_name */
export function guestOrdererNameMatches(
  ordererName: string | null | undefined,
  shippingName: string | null | undefined,
  inputName: string
): boolean {
  const want = normalizeGuestOrdererName(inputName);
  if (!want) return false;
  const on = normalizeGuestOrdererName(ordererName ?? "");
  const ship = normalizeGuestOrdererName(shippingName ?? "");
  return on === want || ship === want;
}

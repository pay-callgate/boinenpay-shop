/** 우리부고·쇼핑몰 고객센터 전화 — `NEXT_PUBLIC_WOORIBUGO_CS_TEL` 우선, 미설정 시 기본값 */
export const SHOP_CS_TEL_DEFAULT = "1661-5382";

export const SHOP_CS_HOURS_WEEKDAY = "평일 08:30 ~ 19:00";

export function getShopCustomerServiceTel(): string {
  return process.env.NEXT_PUBLIC_WOORIBUGO_CS_TEL?.trim() || SHOP_CS_TEL_DEFAULT;
}

export function getShopCustomerServiceTelHref(): string {
  const digits = getShopCustomerServiceTel().replace(/\D/g, "");
  return digits ? `tel:${digits}` : `tel:${SHOP_CS_TEL_DEFAULT.replace(/\D/g, "")}`;
}

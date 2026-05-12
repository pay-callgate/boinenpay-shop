/**
 * 운영 결제 테스트용 폼 기본값.
 *
 * 오픈 전: Vercel(또는 .env)에서 `NEXT_PUBLIC_ENABLE_CHECKOUT_TEST_DEFAULTS` 를 삭제하거나 `0`으로 두고 재배포.
 * 코드 삭제 없이 env 한 줄로 끌 수 있음.
 */
export function isCheckoutTestDefaultsEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_ENABLE_CHECKOUT_TEST_DEFAULTS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** 로컬·스테이징 연습용만. 운영에서는 env 비활성화 권장. */
export const CHECKOUT_TEST_DEFAULTS = {
  ordererName: "",
  ordererPhone: "",
  guestEmail: "",
  guestPassword: "",
  recipientName: "",
  recipientPhone: "",
  shippingPostcode: "",
  shippingAddress: "",
  shippingDetail: "",
  venueDetail: "",
  ribbonSender: "",
  ribbonPreset: "축하합니다",
} as const;

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

/** 테스트 전용 — 오픈 시 env 로 비활성화 */
export const CHECKOUT_TEST_DEFAULTS = {
  ordererName: "홍길동",
  ordererPhone: "01012341234",
  guestEmail: "aa@gmail.com",
  guestPassword: "1111",
  /** 받는 분 / 배송 */
  recipientName: "김무스",
  recipientPhone: "01085209630",
  shippingPostcode: "06236",
  shippingAddress: "서울 강남구 테헤란로 152",
  shippingDetail: "지하 1층 로비 (테스트 배송지)",
  /** 화환/꽃 배달 상세 */
  venueDetail: "테스트용 장소 — 본관 1층 로비",
  /** 리본: 보내는 분란에 전체 표기(양식 예시와 동일) */
  ribbonSender: "주식회사 콜게이트 대표이사 곽두팔",
  /** 프리셋 메시지(보내는 분에 상세를 둔 경우 보조 문구) */
  ribbonPreset: "축하합니다",
} as const;

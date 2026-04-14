import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  return (
    process.env.GUEST_CHECKOUT_HMAC_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "guest-checkout-dev-only"
  );
}

/** 결제 준비/완료 시 orderId + guest_checkout_token 무결성 검증 */
export function signGuestCheckout(orderId: string, guestToken: string): string {
  const h = createHmac("sha256", secret());
  h.update(`${orderId}|${guestToken}`);
  return h.digest("hex");
}

export function verifyGuestCheckout(
  orderId: string,
  guestToken: string,
  signature: string
): boolean {
  if (!orderId || !guestToken || !signature) return false;
  const expected = signGuestCheckout(orderId, guestToken);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

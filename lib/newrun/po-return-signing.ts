import { createHmac, timingSafeEqual } from "node:crypto";

/** po-return 위변조 완화: 발주 시 `rw_returnurl`에 `nrpt` 쿼리를 붙이고, 리턴 시 검증 */
export function buildNewrunPoReturnToken(orderNo: string, secret: string): string {
  return createHmac("sha256", secret).update(orderNo.trim(), "utf8").digest("base64url");
}

export function isValidNewrunPoReturnToken(
  orderNo: string,
  token: string | null | undefined,
  secret: string | undefined
): boolean {
  const s = secret?.trim();
  if (!s) return true;
  const t = token?.trim();
  if (!t) return false;
  const expected = buildNewrunPoReturnToken(orderNo, s);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(t));
  } catch {
    return false;
  }
}

/** `NEWRUN_PO_RETURN_SECRET`이 있으면 `nrpt`를 붙인 절대 URL 반환 */
export function appendNewrunPoReturnTokenToReturnUrl(
  returnUrl: string,
  orderNo: string
): string {
  const secret = process.env.NEWRUN_PO_RETURN_SECRET?.trim();
  if (!secret) return returnUrl;
  const u = new URL(returnUrl);
  u.searchParams.set("nrpt", buildNewrunPoReturnToken(orderNo.trim(), secret));
  return u.toString();
}

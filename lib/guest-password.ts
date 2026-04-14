import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 64;

/** 비회원 주문 조회 비밀번호 — 평문 저장 금지, scrypt 해시만 DB 보관 */
export function hashGuestPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(plain, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyGuestPassword(plain: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;
  if (!saltHex || !hashHex || saltHex.length !== SALT_LEN * 2) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const hash = scryptSync(plain, salt, expected.length);
    return timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}

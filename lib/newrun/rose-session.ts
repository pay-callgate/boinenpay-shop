import { createHash } from "crypto";

/**
 * 뉴런 개발문서 2.2 — PHP 예제와 동일한 `rose_session` 생성.
 *
 * ```php
 * $mytime = time();
 * $mysec = md5($mytime);
 * $mytime = base64_encode($mytime);
 * $myid = base64_encode(발주화원인트라넷아이디);
 * $rose_session = $mytime."DiV".$mysec."DiV".$myid;
 * ```
 *
 * PHP에서 `md5($mytime)`·`base64_encode($mytime)`는 정수 타임스탬프가 문자열로 캐스팅된 값을 사용한다.
 */
export function buildRoseSession(
  intranetId: string,
  options?: { nowSec?: number }
): string {
  const id = intranetId.trim();
  if (!id) {
    throw new Error("buildRoseSession: intranetId is empty");
  }
  const nowSec = options?.nowSec ?? Math.floor(Date.now() / 1000);
  const timeStr = String(nowSec);
  const mysec = createHash("md5").update(timeStr, "utf8").digest("hex");
  const mytimeB64 = Buffer.from(timeStr, "utf8").toString("base64");
  const myidB64 = Buffer.from(id, "utf8").toString("base64");
  return `${mytimeB64}DiV${mysec}DiV${myidB64}`;
}

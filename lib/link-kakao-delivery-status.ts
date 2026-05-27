/**
 * link_kakao_notifications.delivery_status — 접수·최종 배송 상태.
 */

export type LinkKakaoDeliveryStatus =
  | "pending"
  | "success"
  | "failed"
  | "partial";

export function deliveryStatusFromSubmit(
  submitOk: boolean,
  cmid: string | null | undefined
): LinkKakaoDeliveryStatus {
  if (!submitOk) return "failed";
  const id = cmid != null ? String(cmid).trim() : "";
  return id ? "pending" : "failed";
}

export type LinkKakaoDeliveryRowLike = {
  provider_ok: boolean;
  delivery_status?: string | null;
};

/** 목록·정산용: 이 행을 성공 건으로 집계할지 */
export function linkKakaoRowCountsAsDeliveredSuccess(
  row: LinkKakaoDeliveryRowLike
): boolean {
  const ds = row.delivery_status?.trim();
  if (ds === "success" || ds === "partial") return true;
  if (ds === "failed" || ds === "pending") return false;
  return !!row.provider_ok;
}

/** 목록·정산용: 이 행을 실패 건으로 집계할지 */
export function linkKakaoRowCountsAsDeliveredFailed(
  row: LinkKakaoDeliveryRowLike
): boolean {
  const ds = row.delivery_status?.trim();
  if (ds === "failed") return true;
  if (ds === "success" || ds === "partial" || ds === "pending") return false;
  return !row.provider_ok;
}

/** 리포트 동기화 대상 */
export function linkKakaoRowNeedsReportSync(row: {
  provider_ok: boolean;
  delivery_status?: string | null;
  cmid?: string | null;
}): boolean {
  if (!row.provider_ok) return false;
  const cmid = row.cmid != null ? String(row.cmid).trim() : "";
  if (!cmid) return false;
  return row.delivery_status?.trim() === "pending";
}

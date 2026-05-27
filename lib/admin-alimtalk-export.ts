/**
 * 알림톡 발송 내역 엑셀 — 수신자 1행(DB) 기준 컬럼 (목록 그룹 행과 분리).
 */

import type { LinkKakaoNotificationDbRow } from "@/lib/admin-alimtalk-messages";
import { ADMIN_ALIMTALK_STATUS_LABEL } from "@/lib/admin-alimtalk-messages";
import { mapDeliveryStatusToAdminHistoryStatus } from "@/lib/admin-alimtalk-messages";
import {
  linkKakaoRowCountsAsDeliveredFailed,
  linkKakaoRowCountsAsDeliveredSuccess,
} from "@/lib/link-kakao-delivery-status";
import { getMsgagentWebshotResultCodeLabel } from "@/lib/msgagent-webshot-result-codes";
import { formatTransmissionResultForAdminDisplay } from "@/lib/msgagent-transmission-result-codes";

export type AlimtalkExcelRow = Record<string, string | number>;

export function buildAlimtalkExcelRow(
  row: LinkKakaoNotificationDbRow,
  clientName: string
): AlimtalkExcelRow {
  const statusKey = mapDeliveryStatusToAdminHistoryStatus(
    row.delivery_status,
    row.provider_ok
  );
  const submitCode =
    row.result_code != null ? String(row.result_code).trim() : "";
  const kakaoCode =
    row.kakao_report_code != null ? String(row.kakao_report_code).trim() : "";
  const kakaoMsg =
    row.kakao_report_message != null
      ? String(row.kakao_report_message).trim()
      : "";
  const smsCode =
    row.sms_report_code != null ? String(row.sms_report_code).trim() : "";
  const smsMsg =
    row.sms_report_message != null
      ? String(row.sms_report_message).trim()
      : "";
  const submitErr =
    row.error_message != null ? String(row.error_message).trim() : "";
  const finalErr =
    row.final_error_message != null
      ? String(row.final_error_message).trim()
      : "";

  const finalOutcome =
    finalErr ||
    (kakaoCode
      ? formatTransmissionResultForAdminDisplay(kakaoCode, kakaoMsg)
      : "") ||
    submitErr;

  const batchId = row.batch_id?.trim() ?? "";
  const ds = row.delivery_status?.trim() ?? "";

  return {
    발송일시: new Date(row.created_at).toLocaleString("ko-KR"),
    거래처명: clientName.trim() || "(거래처)",
    발송구분: batchId ? "대량발송" : "단건발송",
    배치ID: batchId || "",
    수신자표시: (row.recipient_name ?? "").trim() || "-",
    수신번호_마스킹: row.phone_masked ?? "",
    최종배송상태: ADMIN_ALIMTALK_STATUS_LABEL[statusKey],
    delivery_status: ds || "(미설정)",
    접수성공: row.provider_ok ? "Y" : "N",
    접수결과코드: submitCode,
    접수코드설명: submitCode
      ? getMsgagentWebshotResultCodeLabel(submitCode) ?? ""
      : "",
    카카오전송코드: kakaoCode,
    카카오전송설명: kakaoCode
      ? formatTransmissionResultForAdminDisplay(kakaoCode, kakaoMsg)
      : ds === "pending"
        ? "리포트 대기(결과 갱신 필요)"
        : "",
    LMS전환코드: smsCode,
    LMS전환설명: smsCode
      ? formatTransmissionResultForAdminDisplay(smsCode, smsMsg)
      : kakaoCode && kakaoCode !== "0" && !smsCode
        ? "전환 시도·리포트 미동기화 가능"
        : "",
    최종오류_요약: finalOutcome.replace(/\r?\n/g, " ").slice(0, 500),
    정산_성공건: linkKakaoRowCountsAsDeliveredSuccess(row) ? 1 : 0,
    정산_실패건: linkKakaoRowCountsAsDeliveredFailed(row) ? 1 : 0,
    cmid: "",
    tran_id: "",
    발신번호: row.callback_masked?.trim() || "-",
    내용요약: (row.resolved_msg_preview ?? "")
      .replace(/\r?\n/g, " ")
      .slice(0, 500),
  };
}

/** export 전용 — cmid·tran_id 포함 */
export const LINK_KAKAO_NOTIFICATION_EXPORT_SELECT =
  "id, created_at, partner_id, client_id, phone_masked, callback_masked, provider_ok, delivery_status, result_code, error_message, final_error_message, kakao_report_code, kakao_report_message, sms_report_code, sms_report_message, sms_report_success, resolved_msg_preview, batch_id, recipient_name, cmid, tran_id";

export function buildAlimtalkExcelRowWithIds(
  row: LinkKakaoNotificationDbRow & { cmid?: string | null; tran_id?: string | null },
  clientName: string
): AlimtalkExcelRow {
  const base = buildAlimtalkExcelRow(row, clientName);
  return {
    ...base,
    cmid: row.cmid != null ? String(row.cmid).trim() : "",
    tran_id: row.tran_id != null ? String(row.tran_id).trim() : "",
  };
}

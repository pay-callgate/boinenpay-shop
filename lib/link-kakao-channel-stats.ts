/**
 * 알림톡·LMS(전환) 채널별 성공/실패 집계 (리포트 동기화 후 DB 필드 기준).
 */

import {
  isTransmissionResultSuccess,
  parseTransmissionResultCode,
} from "@/lib/msgagent-transmission-result-codes";

export type LinkKakaoChannelCounts = {
  kakaoSuccess: number;
  kakaoFail: number;
  smsSuccess: number;
  smsFail: number;
};

const ZERO: LinkKakaoChannelCounts = {
  kakaoSuccess: 0,
  kakaoFail: 0,
  smsSuccess: 0,
  smsFail: 0,
};

function codeIsSuccess(code: string | null | undefined): boolean | null {
  const c = code != null ? String(code).trim() : "";
  if (!c) return null;
  return isTransmissionResultSuccess(parseTransmissionResultCode(c));
}

export type LinkKakaoChannelStatsRow = {
  provider_ok: boolean;
  delivery_status?: string | null;
  kakao_report_code?: string | null;
  sms_report_code?: string | null;
  sms_report_success?: boolean | null;
};

/** 수신자 1행(DB) 기준 카카오톡·문자 전환 건수 (0 또는 1) */
export function channelCountsFromLinkKakaoRow(
  row: LinkKakaoChannelStatsRow
): LinkKakaoChannelCounts {
  const ds = row.delivery_status?.trim();
  if (ds === "pending") return { ...ZERO };

  const kakaoCode =
    row.kakao_report_code != null ? String(row.kakao_report_code).trim() : "";
  const smsCode =
    row.sms_report_code != null ? String(row.sms_report_code).trim() : "";

  const out = { ...ZERO };

  const kakaoFromCode = codeIsSuccess(kakaoCode);
  if (kakaoFromCode === true) {
    out.kakaoSuccess = 1;
  } else if (kakaoFromCode === false) {
    out.kakaoFail = 1;
  } else if (ds === "success") {
    out.kakaoSuccess = 1;
  } else if (ds === "partial" || ds === "failed") {
    out.kakaoFail = 1;
  } else if (row.provider_ok) {
    out.kakaoSuccess = 1;
  }

  const smsFromCode = codeIsSuccess(smsCode);
  if (smsFromCode === true) {
    out.smsSuccess = 1;
  } else if (smsFromCode === false) {
    out.smsFail = 1;
  } else if (row.sms_report_success === true) {
    out.smsSuccess = 1;
  } else if (row.sms_report_success === false) {
    out.smsFail = 1;
  } else if (ds === "partial") {
    out.smsSuccess = 1;
  }

  return out;
}

export function sumChannelCountsFromRows(
  rows: LinkKakaoChannelStatsRow[]
): LinkKakaoChannelCounts {
  return rows.reduce(
    (acc, row) => {
      const c = channelCountsFromLinkKakaoRow(row);
      return {
        kakaoSuccess: acc.kakaoSuccess + c.kakaoSuccess,
        kakaoFail: acc.kakaoFail + c.kakaoFail,
        smsSuccess: acc.smsSuccess + c.smsSuccess,
        smsFail: acc.smsFail + c.smsFail,
      };
    },
    { ...ZERO }
  );
}

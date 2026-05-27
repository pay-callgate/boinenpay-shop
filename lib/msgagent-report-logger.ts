/**
 * MsgAgent 리포트(카카오/문자) 조회·동기화 로깅.
 * - 로컬: 터미널 구분선 블록 (발송 로그와 동일 패턴)
 * - Vercel: lib/logger JSON stdout → Runtime Logs에서 검색 (message: msgagent_report)
 */

import { logger } from "@/lib/logger";
import {
  msgagentConsoleError,
  msgagentConsoleLog,
} from "@/lib/msgagent-send-logger";

const LOG_EVENT = "msgagent_report";

export function logMsgagentReportJson(
  phase: "request" | "response" | "sync_row" | "sync_summary" | "error",
  data: Record<string, unknown>
): void {
  logger.info(LOG_EVENT, {
    action: phase,
    data: { service: "msgagent_report", ...data },
  });
}

export function logMsgagentReportRequestBlock(params: {
  kind: "kakao" | "general";
  requestUrl: string;
  cmidCount: number;
  cmidListPreview?: string;
}): void {
  const ts = new Date().toISOString();
  msgagentConsoleLog(
    `\n========== [Report 요청·${params.kind}] ${ts} ==========`
  );
  msgagentConsoleLog("[Report] method: POST");
  msgagentConsoleLog("[Report] URL:", params.requestUrl);
  msgagentConsoleLog("[Report] cmid 건수:", params.cmidCount);
  if (params.cmidListPreview) {
    msgagentConsoleLog("[Report] cmid_list(일부):", params.cmidListPreview);
  }
  msgagentConsoleLog("==========================================\n");

  logMsgagentReportJson("request", {
    kind: params.kind,
    requestUrl: params.requestUrl,
    cmidCount: params.cmidCount,
  });
}

export function logMsgagentReportResponseBlock(params: {
  kind: "kakao" | "general";
  requestUrl: string;
  apiResultCode: number | null;
  apiResultMessage: string | null;
  entryCount: number;
  rawBodyPreview: string;
}): void {
  const ts = new Date().toISOString();
  msgagentConsoleLog(
    `\n========== [Report 응답·${params.kind}] ${ts} ==========`
  );
  msgagentConsoleLog("[Report] URL:", params.requestUrl);
  msgagentConsoleLog(
    "[Report] API result_code:",
    params.apiResultCode ?? "(없음)",
    params.apiResultMessage ? `— ${params.apiResultMessage}` : ""
  );
  msgagentConsoleLog("[Report] reportList 건수:", params.entryCount);
  if (params.rawBodyPreview) {
    msgagentConsoleLog(
      "[Report] 본문(raw 일부):",
      params.rawBodyPreview.slice(0, 2500)
    );
  }
  msgagentConsoleLog("==========================================\n");

  logMsgagentReportJson("response", {
    kind: params.kind,
    requestUrl: params.requestUrl,
    apiResultCode: params.apiResultCode,
    apiResultMessage: params.apiResultMessage,
    entryCount: params.entryCount,
  });
}

export function logMsgagentReportSyncRow(params: {
  notificationId: string;
  phoneMasked?: string | null;
  cmid: string;
  deliveryStatus: string;
  kakaoCode: string | null;
  kakaoMessage: string | null;
  smsCode: string | null;
  smsMessage: string | null;
  resendMsgId?: string | null;
}): void {
  const phone = params.phoneMasked?.trim() || "***";
  const line = [
    `[Report 동기화] phone=${phone}`,
    `cmid=${params.cmid}`,
    `delivery=${params.deliveryStatus}`,
    `kakao=${params.kakaoCode ?? "-"}${params.kakaoMessage ? `(${params.kakaoMessage.slice(0, 80)})` : ""}`,
    `sms=${params.smsCode ?? "-"}${params.smsMessage ? `(${params.smsMessage.slice(0, 80)})` : ""}`,
    params.resendMsgId ? `resendMsgId=${params.resendMsgId}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  msgagentConsoleLog(line);

  logMsgagentReportJson("sync_row", {
    notificationId: params.notificationId,
    phoneMasked: params.phoneMasked,
    cmid: params.cmid,
    deliveryStatus: params.deliveryStatus,
    kakaoCode: params.kakaoCode,
    smsCode: params.smsCode,
    resendMsgId: params.resendMsgId,
  });
}

export function logMsgagentReportSyncSummary(
  result: Record<string, unknown>
): void {
  msgagentConsoleLog("\n========== [Report 동기화 요약] ==========");
  msgagentConsoleLog(JSON.stringify(result, null, 2));
  msgagentConsoleLog("==========================================\n");

  logMsgagentReportJson("sync_summary", result);
}

export function logMsgagentReportErrorBlock(params: {
  kind: string;
  message: string;
  detail?: unknown;
}): void {
  msgagentConsoleError(
    `\n========== [Report 오류·${params.kind}] ${new Date().toISOString()} ==========`
  );
  msgagentConsoleError("[Report]", params.message);
  if (params.detail !== undefined) {
    msgagentConsoleError("[Report] detail:", params.detail);
  }
  msgagentConsoleError("==========================================\n");

  logger.error(LOG_EVENT, {
    action: "error",
    data: {
      service: "msgagent_report",
      kind: params.kind,
      message: params.message,
      detail: String(params.detail),
    },
  });
}

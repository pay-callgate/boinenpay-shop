/**
 * SMTNT Agent2 Webshot — 카카오/문자 리포트 API
 * - POST .../api/webshot/report/kakao/{id}
 * - POST .../api/webshot/multiple/report/kakao/{id}
 * - POST .../api/webshot/report/general/{id}
 * - POST .../api/webshot/multiple/report/general/{id}
 */

import type { LinkKakaoDeliveryStatus } from "@/lib/link-kakao-delivery-status";
import { parseMsgagentWebshotResultCode } from "@/lib/msgagent-kakao";
import {
  logMsgagentReportErrorBlock,
  logMsgagentReportRequestBlock,
  logMsgagentReportResponseBlock,
} from "@/lib/msgagent-report-logger";
import {
  formatTransmissionResultForAdminDisplay,
  isTransmissionResultSuccess,
  parseTransmissionResultCode,
} from "@/lib/msgagent-transmission-result-codes";

export type MsgagentKakaoReportEntry = {
  cmid: string | null;
  phone: string | null;
  tranId: string | null;
  reportTime: string | null;
  status: string | null;
  statusName: string | null;
  resultCode: number | null;
  resultName: string | null;
  resendMsgId: string | null;
  resendResultCode: number | null;
  resendResultName: string | null;
  resendMsgYn: string | null;
  resendRequestYn: string | null;
};

export type MsgagentReportFetchResult = {
  apiResultCode: number | null;
  apiResultMessage: string | null;
  entries: MsgagentKakaoReportEntry[];
  raw: unknown;
};

export type NormalizedDeliveryOutcome = {
  deliveryStatus: LinkKakaoDeliveryStatus;
  kakaoSuccess: boolean | null;
  kakaoCode: string | null;
  kakaoMessage: string | null;
  smsSuccess: boolean | null;
  smsCode: string | null;
  smsMessage: string | null;
  finalErrorMessage: string | null;
};

const DEFAULT_BASE = "https://api2.msgagent.com";
const REPORT_LIST_MAX = 100;

function trimEnv(key: string): string {
  return String(process.env[key] ?? "").trim();
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

export function parseKakaoReportEntry(
  raw: Record<string, unknown>
): MsgagentKakaoReportEntry {
  const resultCode = parseTransmissionResultCode(
    raw.result ?? raw.Result ?? raw.RESULT
  );
  const resendResultCode = parseTransmissionResultCode(
    raw.resendResult ?? raw.resend_result
  );
  return {
    cmid: pickString(raw, ["cmid", "CMID", "msgId", "msg_id"]),
    phone: pickString(raw, ["PHONE", "phone"]),
    tranId: pickString(raw, ["tran_id", "tranId"]),
    reportTime: pickString(raw, ["Report_time", "report_time", "reportTime"]),
    status: pickString(raw, ["STATUS", "status"]),
    statusName: pickString(raw, ["statusName", "status_name"]),
    resultCode,
    resultName: pickString(raw, ["resultName", "result_name"]),
    resendMsgId: pickString(raw, ["resendMsgId", "resend_msg_id"]),
    resendResultCode,
    resendResultName: pickString(raw, [
      "resendResultName",
      "resend_result_name",
    ]),
    resendMsgYn: pickString(raw, ["resend_msg_yn", "resendMsgYn"]),
    resendRequestYn: pickString(raw, [
      "resend_request_yn",
      "resendRequestYn",
    ]),
  };
}

export function extractReportList(parsed: unknown): Record<string, unknown>[] {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }
  const root = parsed as Record<string, unknown>;
  const list = root.reportList ?? root.report_list ?? root.ReportList;
  if (Array.isArray(list)) {
    return list.filter(
      (x): x is Record<string, unknown> =>
        !!x && typeof x === "object" && !Array.isArray(x)
    );
  }
  if (
    root.cmid !== undefined ||
    root.CMID !== undefined ||
    root.result !== undefined ||
    root.Result !== undefined
  ) {
    return [root];
  }
  return [];
}

export function entriesByCmid(
  entries: MsgagentKakaoReportEntry[]
): Map<string, MsgagentKakaoReportEntry> {
  const map = new Map<string, MsgagentKakaoReportEntry>();
  for (const e of entries) {
    const id = e.cmid?.trim();
    if (id) map.set(id, e);
  }
  return map;
}

/** 리포트 API `result_code` 803 — 당일 발송 데이터 없음 → 아직 pending 유지 */
export function isReportApiNoDataYet(apiResultCode: number | null): boolean {
  return apiResultCode === 803;
}

export function deriveDeliveryOutcome(
  kakao: MsgagentKakaoReportEntry | null,
  sms: MsgagentKakaoReportEntry | null
): NormalizedDeliveryOutcome {
  if (!kakao || kakao.resultCode === null) {
    return {
      deliveryStatus: "pending",
      kakaoSuccess: null,
      kakaoCode: null,
      kakaoMessage: null,
      smsSuccess: null,
      smsCode: null,
      smsMessage: null,
      finalErrorMessage: null,
    };
  }

  const kakaoOk = isTransmissionResultSuccess(kakao.resultCode);
  const kakaoCode = String(kakao.resultCode);
  const kakaoMsg =
    kakao.resultName?.trim() ||
    formatTransmissionResultForAdminDisplay(kakaoCode);

  if (kakaoOk) {
    return {
      deliveryStatus: "success",
      kakaoSuccess: true,
      kakaoCode,
      kakaoMessage: kakaoMsg,
      smsSuccess: null,
      smsCode: null,
      smsMessage: null,
      finalErrorMessage: null,
    };
  }

  const resendId = kakao.resendMsgId?.trim();
  const inlineResendOk =
    kakao.resendResultCode !== null &&
    isTransmissionResultSuccess(kakao.resendResultCode);
  const inlineResendCode =
    kakao.resendResultCode !== null ? String(kakao.resendResultCode) : null;
  const inlineResendMsg =
    kakao.resendResultName?.trim() ||
    (inlineResendCode
      ? formatTransmissionResultForAdminDisplay(inlineResendCode)
      : null);

  if (sms && sms.resultCode !== null) {
    const smsOk = isTransmissionResultSuccess(sms.resultCode);
    const smsCode = String(sms.resultCode);
    const smsMsg =
      sms.resultName?.trim() ||
      formatTransmissionResultForAdminDisplay(smsCode);
    if (smsOk) {
      return {
        deliveryStatus: "partial",
        kakaoSuccess: false,
        kakaoCode,
        kakaoMessage: kakaoMsg,
        smsSuccess: true,
        smsCode,
        smsMessage: smsMsg,
        finalErrorMessage: null,
      };
    }
    return {
      deliveryStatus: "failed",
      kakaoSuccess: false,
      kakaoCode,
      kakaoMessage: kakaoMsg,
      smsSuccess: false,
      smsCode,
      smsMessage: smsMsg,
      finalErrorMessage: `카카오: ${kakaoMsg} / 대체(LMS): ${smsMsg}`,
    };
  }

  if (resendId && inlineResendOk) {
    return {
      deliveryStatus: "partial",
      kakaoSuccess: false,
      kakaoCode,
      kakaoMessage: kakaoMsg,
      smsSuccess: true,
      smsCode: inlineResendCode,
      smsMessage: inlineResendMsg,
      finalErrorMessage: null,
    };
  }

  if (resendId && inlineResendCode && !inlineResendOk) {
    return {
      deliveryStatus: "failed",
      kakaoSuccess: false,
      kakaoCode,
      kakaoMessage: kakaoMsg,
      smsSuccess: false,
      smsCode: inlineResendCode,
      smsMessage: inlineResendMsg,
      finalErrorMessage: `카카오: ${kakaoMsg} / 대체: ${inlineResendMsg ?? inlineResendCode}`,
    };
  }

  return {
    deliveryStatus: "failed",
    kakaoSuccess: false,
    kakaoCode,
    kakaoMessage: kakaoMsg,
    smsSuccess: null,
    smsCode: null,
    smsMessage: null,
    finalErrorMessage: kakaoMsg,
  };
}

export function buildDeliveryReportDbPatch(
  outcome: NormalizedDeliveryOutcome,
  reportRaw: unknown
): Record<string, unknown> {
  return {
    delivery_status: outcome.deliveryStatus,
    report_synced_at: new Date().toISOString(),
    kakao_report_code: outcome.kakaoCode,
    kakao_report_message: outcome.kakaoMessage,
    kakao_report_success: outcome.kakaoSuccess,
    sms_report_code: outcome.smsCode,
    sms_report_message: outcome.smsMessage,
    sms_report_success: outcome.smsSuccess,
    final_error_message: outcome.finalErrorMessage,
    report_raw_response: reportRaw ?? null,
  };
}

async function postMsgagentReport(
  path: string,
  fields: Record<string, string>,
  kind: "kakao" | "general"
): Promise<MsgagentReportFetchResult> {
  const userId = fields.id?.trim();
  if (!userId) {
    throw new Error("MSGAGENT_USER_ID(또는 id)가 필요합니다.");
  }

  const base = trimEnv("MSGAGENT_BASE") || DEFAULT_BASE;
  const url = `${base.replace(/\/$/, "")}${path}`;

  const cmidList = fields.cmid_list?.trim() ?? "";
  const cmidCount = cmidList
    ? cmidList.split("|").filter(Boolean).length
    : fields.cmid
      ? 1
      : 0;

  logMsgagentReportRequestBlock({
    kind,
    requestUrl: url,
    cmidCount,
    cmidListPreview: cmidList ? cmidList.slice(0, 200) : fields.cmid,
  });

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (v) body.append(k, v);
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const text = await upstream.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    const apiResultCode = parseMsgagentWebshotResultCode(parsed);
    let apiResultMessage: string | null = null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const r = parsed as Record<string, unknown>;
      apiResultMessage =
        (typeof r.result_msg === "string" && r.result_msg.trim()) ||
        (typeof r.resultMsg === "string" && r.resultMsg.trim()) ||
        null;
    }

    const entries = extractReportList(parsed).map(parseKakaoReportEntry);

    logMsgagentReportResponseBlock({
      kind,
      requestUrl: url,
      apiResultCode,
      apiResultMessage,
      entryCount: entries.length,
      rawBodyPreview: text,
    });

    return {
      apiResultCode,
      apiResultMessage,
      entries,
      raw: parsed,
    };
  } catch (e) {
    logMsgagentReportErrorBlock({
      kind,
      message: e instanceof Error ? e.message : String(e),
      detail: e,
    });
    throw e;
  }
}

export async function fetchKakaoReport(
  cmid: string,
  opts?: { userId?: string }
): Promise<MsgagentReportFetchResult> {
  const userId = (opts?.userId ?? trimEnv("MSGAGENT_USER_ID")).trim();
  const id = String(cmid ?? "").trim();
  if (!id) throw new Error("cmid가 필요합니다.");
  return postMsgagentReport(
    `/api/webshot/report/kakao/${encodeURIComponent(userId)}`,
    { id: userId, cmid: id },
    "kakao"
  );
}

export async function fetchKakaoReports(
  cmids: string[],
  opts?: { userId?: string }
): Promise<MsgagentReportFetchResult> {
  const userId = (opts?.userId ?? trimEnv("MSGAGENT_USER_ID")).trim();
  const list = [...new Set(cmids.map((c) => String(c).trim()).filter(Boolean))];
  if (list.length === 0) {
    return {
      apiResultCode: null,
      apiResultMessage: null,
      entries: [],
      raw: null,
    };
  }
  if (list.length > REPORT_LIST_MAX) {
    throw new Error(`리포트 조회는 최대 ${REPORT_LIST_MAX}건까지 가능합니다.`);
  }
  return postMsgagentReport(
    `/api/webshot/multiple/report/kakao/${encodeURIComponent(userId)}`,
    { id: userId, cmid_list: list.join("|") },
    "kakao"
  );
}

export async function fetchGeneralReport(
  cmid: string,
  opts?: { userId?: string }
): Promise<MsgagentReportFetchResult> {
  const userId = (opts?.userId ?? trimEnv("MSGAGENT_USER_ID")).trim();
  const id = String(cmid ?? "").trim();
  if (!id) throw new Error("cmid가 필요합니다.");
  return postMsgagentReport(
    `/api/webshot/report/general/${encodeURIComponent(userId)}`,
    { id: userId, cmid: id },
    "general"
  );
}

export async function fetchGeneralReports(
  cmids: string[],
  opts?: { userId?: string }
): Promise<MsgagentReportFetchResult> {
  const userId = (opts?.userId ?? trimEnv("MSGAGENT_USER_ID")).trim();
  const list = [...new Set(cmids.map((c) => String(c).trim()).filter(Boolean))];
  if (list.length === 0) {
    return {
      apiResultCode: null,
      apiResultMessage: null,
      entries: [],
      raw: null,
    };
  }
  if (list.length > REPORT_LIST_MAX) {
    throw new Error(`리포트 조회는 최대 ${REPORT_LIST_MAX}건까지 가능합니다.`);
  }
  return postMsgagentReport(
    `/api/webshot/multiple/report/general/${encodeURIComponent(userId)}`,
    { id: userId, cmid_list: list.join("|") },
    "general"
  );
}

export function chunkCmids(cmids: string[], size = REPORT_LIST_MAX): string[][] {
  const unique = [...new Set(cmids.map((c) => String(c).trim()).filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += size) {
    chunks.push(unique.slice(i, i + size));
  }
  return chunks;
}

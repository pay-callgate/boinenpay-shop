/**
 * SMTNT Agent2 Webshot — API_SEND_KAKAO(알림톡)
 * POST multipart/form-data → https://api2.msgagent.com/api/webshot/send/kakao/AT/{id}
 */

import {
  formatSenderKeyForLog,
  logMsgagentErrorBlock,
  logMsgagentRequestBlock,
  logMsgagentResponseBlock,
} from "@/lib/msgagent-send-logger";

export type SendKakaoAlimtalkAtInput = {
  /** URL 경로·폼 id (환경 MSGAGENT_USER_ID 기본) */
  userId?: string;
  /** 수신 (숫자만 권장) */
  phone: string;
  /** 발신 CALLBACK */
  callback?: string;
  /** 본문 — 템플릿 치환 완료본 권장, 최대 1000자 */
  msg: string;
  senderKey?: string;
  templateCode?: string;
  failedType?: string;
  failedSubject?: string;
  failedMsg?: string;
  tranId?: string;
  resellerCode?: string;
  reqdate?: string;
  btnTypes?: string;
  btnTxts?: string;
  btnUrls1?: string;
  btnUrls2?: string;
};

export type SendKakaoAlimtalkAtResult = {
  ok: boolean;
  httpStatus: number;
  requestUrl: string;
  response: unknown;
  resolvedMsg: string;
  resolvedFailedMsg?: string;
};

const DEFAULT_BASE = "https://api2.msgagent.com";

function trimEnv(key: string): string {
  return String(process.env[key] ?? "").trim();
}

export async function sendKakaoAlimtalkAt(
  input: SendKakaoAlimtalkAtInput
): Promise<SendKakaoAlimtalkAtResult> {
  const userId = (input.userId || trimEnv("MSGAGENT_USER_ID")).trim();
  if (!userId) {
    throw new Error("MSGAGENT_USER_ID(또는 userId)가 필요합니다.");
  }

  const phone = String(input.phone ?? "").replace(/\s/g, "");
  const callback = String(
    input.callback ?? trimEnv("MSGAGENT_CALLBACK")
  ).replace(/\s/g, "");
  const senderKey = String(
    input.senderKey ?? trimEnv("MSGAGENT_SENDER_KEY")
  ).trim();
  const templateCode = String(
    input.templateCode ?? trimEnv("MSGAGENT_TEMPLATE_CODE")
  ).trim();
  const failedType = (
    input.failedType?.trim() ||
    trimEnv("MSGAGENT_FAILED_TYPE") ||
    "LMS"
  ).trim();
  const resellerCode = String(
    input.resellerCode ?? trimEnv("MSGAGENT_RESELLER_CODE")
  ).trim();
  const tranId = String(input.tranId ?? "").trim();
  const reqdate = String(input.reqdate ?? "").trim();

  const failedSubject = String(
    input.failedSubject ?? trimEnv("MSGAGENT_FAILED_SUBJECT")
  ).trim();
  const failedMsgExplicit = input.failedMsg;
  const msgRaw = String(input.msg ?? "");
  const failedMsgSource =
    failedMsgExplicit != null && String(failedMsgExplicit).trim() !== ""
      ? String(failedMsgExplicit)
      : msgRaw;

  const msg = msgRaw.trim().slice(0, 1000);
  const failedMsg = failedMsgSource.trim().slice(0, 1000);

  if (!phone) {
    throw new Error("수신번호(PHONE)는 필수입니다.");
  }
  if (!msgRaw.trim()) {
    throw new Error("메시지(MSG)는 필수입니다.");
  }
  if (!msg) {
    throw new Error("메시지 본문이 비었습니다.");
  }
  if (!senderKey) {
    throw new Error("SENDER_KEY(MSGAGENT_SENDER_KEY)가 필요합니다.");
  }
  if (!templateCode) {
    throw new Error("TEMPLATE_CODE(MSGAGENT_TEMPLATE_CODE)가 필요합니다.");
  }

  const base = trimEnv("MSGAGENT_BASE") || DEFAULT_BASE;
  const url = `${base.replace(/\/$/, "")}/api/webshot/send/kakao/AT/${encodeURIComponent(userId)}`;

  const form = new FormData();
  form.append("id", userId);
  if (tranId) form.append("tran_id", tranId.slice(0, 29));
  if (resellerCode) form.append("resellerCode", resellerCode);
  form.append("PHONE", phone);
  if (callback) form.append("CALLBACK", callback);
  if (reqdate) form.append("REQDATE", reqdate);
  form.append("MSG", msg);
  form.append("SENDER_KEY", senderKey);
  form.append("TEMPLATE_CODE", templateCode);
  form.append("FAILED_TYPE", failedType);
  if (failedSubject && failedType !== "SMS") {
    form.append("FAILED_SUBJECT", failedSubject);
  }
  if (failedMsg) form.append("FAILED_MSG", failedMsg);

  const btnTypes = String(
    input.btnTypes ?? trimEnv("MSGAGENT_BTN_TYPES")
  ).trim();
  const btnTxts = String(input.btnTxts ?? trimEnv("MSGAGENT_BTN_TXTS")).trim();
  const btnUrls1 = String(
    input.btnUrls1 ?? trimEnv("MSGAGENT_BTN_URLS1")
  ).trim();
  const btnUrls2 = String(
    input.btnUrls2 ?? trimEnv("MSGAGENT_BTN_URLS2")
  ).trim();
  if (btnTypes) form.append("BTN_TYPES", btnTypes);
  if (btnTxts) form.append("BTN_TXTS", btnTxts);
  if (btnUrls1) form.append("BTN_URLS1", btnUrls1);
  if (btnUrls2) form.append("BTN_URLS2", btnUrls2);

  const tranOut = tranId ? tranId.slice(0, 29) : "";
  const requestFields: Record<string, string | undefined> = {
    id: userId,
    ...(tranOut ? { tran_id: tranOut } : {}),
    ...(resellerCode ? { resellerCode } : {}),
    PHONE: phone,
    ...(callback ? { CALLBACK: callback } : {}),
    ...(reqdate ? { REQDATE: reqdate } : {}),
    MSG: msg,
    SENDER_KEY: formatSenderKeyForLog(senderKey),
    TEMPLATE_CODE: templateCode,
    FAILED_TYPE: failedType,
    ...(failedSubject && failedType !== "SMS"
      ? { FAILED_SUBJECT: failedSubject }
      : {}),
    ...(failedMsg ? { FAILED_MSG: failedMsg } : {}),
    ...(btnTypes ? { BTN_TYPES: btnTypes } : {}),
    ...(btnTxts ? { BTN_TXTS: btnTxts } : {}),
    ...(btnUrls1 ? { BTN_URLS1: btnUrls1 } : {}),
    ...(btnUrls2 ? { BTN_URLS2: btnUrls2 } : {}),
  };

  logMsgagentRequestBlock({ requestUrl: url, requestFields });

  try {
    const upstream = await fetch(url, { method: "POST", body: form });
    const text = await upstream.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    const headerObj = Object.fromEntries(upstream.headers.entries());
    logMsgagentResponseBlock({
      requestUrl: url,
      httpStatus: upstream.status,
      statusText: upstream.statusText,
      headers: headerObj,
      rawBody: text,
      parsedBody: parsed,
    });

    return {
      ok: upstream.ok,
      httpStatus: upstream.status,
      requestUrl: url,
      response: parsed,
      resolvedMsg: msg,
      ...(failedMsg ? { resolvedFailedMsg: failedMsg } : {}),
    };
  } catch (e) {
    logMsgagentErrorBlock({ requestUrl: url, error: e });
    throw e;
  }
}

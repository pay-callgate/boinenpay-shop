/**
 * SMTNT Agent2(카카오 알림톡 등) 발송 요청/응답 로깅.
 * - 터미널: kakaotest/server.mjs 와 유사한 구분선 블록
 * - 운영(Vercel 등): stdout JSON 라인(기존 lib/logger)으로 드레인·검색 가능
 * - 선택: AGENT_LOG_DIR 설정 시 일별 .log 파일 append (로컬/자체 서버)
 */

import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";

const LOG_EVENT = "msgagent_send";

function serializeArg(arg: unknown): string {
  if (arg instanceof Error) return arg.stack || String(arg);
  if (typeof arg === "object" && arg !== null) {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

/** 터미널·파일용: 발신 프로필 키 노출 방지 */
export function formatSenderKeyForLog(value: string | undefined): string {
  if (process.env.LOG_FULL_SENDER_KEY === "1") return value ?? "";
  if (!value) return "";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 4)}…(총 ${value.length}자)`;
}

let logDirReady = false;

function agentLogFilePath(): string {
  const base = process.env.AGENT_LOG_DIR!.trim();
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return path.join(base, `agent-${y}-${m}-${day}.log`);
}

function appendAgentLogLine(line: string): void {
  const dir = process.env.AGENT_LOG_DIR?.trim();
  if (!dir) return;
  try {
    if (!logDirReady) {
      fs.mkdirSync(dir, { recursive: true });
      logDirReady = true;
    }
    fs.appendFileSync(agentLogFilePath(), `${line}\n`, "utf8");
  } catch {
    // Vercel 등 읽기 전용 FS — 무시, 콘솔·JSON 로그만 사용
  }
}

/** 터미널 + structured logger. 파일 append는 AGENT_LOG_DIR 설정 시에만 (kakaotest 와 동일 패턴). */
export function msgagentConsoleLog(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log(...args);
  const line = args.map(serializeArg).join(" ");
  if (process.env.AGENT_LOG_DIR?.trim()) {
    appendAgentLogLine(line);
  }
}

export function msgagentConsoleError(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error(...args);
  const line = args.map(serializeArg).join(" ");
  if (process.env.AGENT_LOG_DIR?.trim()) {
    appendAgentLogLine(`[ERROR] ${line}`);
  }
}

export function logMsgagentJson(
  phase: "request" | "response" | "error",
  data: Record<string, unknown>
): void {
  logger.info(LOG_EVENT, {
    action: phase,
    data: {
      ...data,
      service: "msgagent_kakao_at",
    },
  });
}

export function logMsgagentRequestBlock(params: {
  requestUrl: string;
  requestFields: Record<string, string | undefined>;
}): void {
  const reqTs = new Date().toISOString();
  msgagentConsoleLog(`\n========== [Agent 요청] ${reqTs} ==========`);
  msgagentConsoleLog("[Agent] method: POST");
  msgagentConsoleLog("[Agent] Content-Type: multipart/form-data (boundary 자동)");
  msgagentConsoleLog("[Agent] URL:", params.requestUrl);
  msgagentConsoleLog("[Agent] 본문 필드:", JSON.stringify(params.requestFields, null, 2));
  msgagentConsoleLog("==========================================\n");

  logMsgagentJson("request", {
    requestUrl: params.requestUrl,
    requestFields: params.requestFields,
  });
}

export function logMsgagentResponseBlock(params: {
  requestUrl: string;
  httpStatus: number;
  statusText: string;
  headers: Record<string, string>;
  rawBody: string;
  parsedBody: unknown;
}): void {
  const ts = new Date().toISOString();
  msgagentConsoleLog(`\n========== [Agent 응답] ${ts} ==========`);
  msgagentConsoleLog(`[Agent] 요청 URL: ${params.requestUrl}`);
  msgagentConsoleLog(`[Agent] HTTP: ${params.httpStatus} ${params.statusText}`);
  msgagentConsoleLog("[Agent] 응답 헤더:", JSON.stringify(params.headers, null, 2));
  msgagentConsoleLog("[Agent] 응답 본문(raw):", params.rawBody);
  msgagentConsoleLog(
    "[Agent] 응답 본문(JSON):",
    typeof params.parsedBody === "object" && params.parsedBody !== null
      ? JSON.stringify(params.parsedBody, null, 2)
      : String(params.parsedBody)
  );

  const p = params.parsedBody as Record<string, unknown> | null;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    const rc = p.result_code;
    const cmid = p.cmid;
    msgagentConsoleLog(
      `[Agent] 매뉴얼 결과 필드 — result_code: ${rc === undefined ? "(없음)" : JSON.stringify(rc)}, cmid: ${cmid === undefined ? "(없음)" : JSON.stringify(cmid)}`
    );
  }
  msgagentConsoleLog("==========================================\n");

  logMsgagentJson("response", {
    requestUrl: params.requestUrl,
    httpStatus: params.httpStatus,
    resultCode:
      params.parsedBody &&
      typeof params.parsedBody === "object" &&
      !Array.isArray(params.parsedBody)
        ? (params.parsedBody as Record<string, unknown>).result_code
        : undefined,
    cmid:
      params.parsedBody &&
      typeof params.parsedBody === "object" &&
      !Array.isArray(params.parsedBody)
        ? (params.parsedBody as Record<string, unknown>).cmid
        : undefined,
    rawBodyPreview: params.rawBody.slice(0, 2000),
  });
}

export function logMsgagentErrorBlock(params: {
  requestUrl: string;
  error: unknown;
}): void {
  msgagentConsoleError(`\n========== [Agent 오류] ${new Date().toISOString()} ==========`);
  msgagentConsoleError("[Agent] 요청 URL:", params.requestUrl);
  msgagentConsoleError("[Agent] 예외:", params.error);
  msgagentConsoleError("==========================================\n");

  logger.error(LOG_EVENT, {
    action: "error",
    data: {
      service: "msgagent_kakao_at",
      requestUrl: params.requestUrl,
      error: serializeArg(params.error),
    },
  });
}

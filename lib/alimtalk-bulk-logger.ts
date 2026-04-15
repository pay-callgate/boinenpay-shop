/**
 * 카카오 알림톡 대량 발송 전용 로그.
 * 포맷: [YYYY-MM-DD HH:mm:ss] [INFO|ERROR] [AlimtalkBulk] ...
 * AGENT_LOG_DIR 설정 시 agent-YYYY-MM-DD.log 에 append (msgagent-send-logger 와 동일 디렉터리 규칙)
 */

import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 로컬 시각 YYYY-MM-DD HH:mm:ss */
export function alimtalkBulkTimestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

let logDirReady = false;

function agentLogFilePath(): string {
  const base = process.env.AGENT_LOG_DIR!.trim();
  const d = new Date();
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return path.join(base, `agent-${y}-${m}-${day}.log`);
}

function appendLine(line: string): void {
  const dir = process.env.AGENT_LOG_DIR?.trim();
  if (!dir) return;
  try {
    if (!logDirReady) {
      fs.mkdirSync(dir, { recursive: true });
      logDirReady = true;
    }
    fs.appendFileSync(agentLogFilePath(), `${line}\n`, "utf8");
  } catch {
    // 읽기 전용 FS 등 — 무시
  }
}

export function logAlimtalkBulk(
  level: "INFO" | "ERROR",
  message: string,
  meta?: Record<string, unknown>
): void {
  const ts = alimtalkBulkTimestamp();
  const line = `[${ts}] [${level}] [AlimtalkBulk] ${message}`;
  if (level === "ERROR") {
    // eslint-disable-next-line no-console
    console.error(line, meta ?? "");
  } else {
    // eslint-disable-next-line no-console
    console.log(line, meta ?? "");
  }
  appendLine(line);
  logger.info("alimtalk_bulk", {
    action: "AlimtalkBulk",
    data: { level, detail: message, ...(meta ?? {}) },
  });
}

/** 작업 종료 요약 (필수) */
export function logAlimtalkBulkSummary(params: {
  attempted: number;
  success: number;
  failed: number;
}): void {
  const { attempted, success, failed } = params;
  const msg = `총 발송 시도: ${attempted}건, 성공: ${success}건, 실패: ${failed}건`;
  logAlimtalkBulk("INFO", msg, { attempted, success, failed });
}

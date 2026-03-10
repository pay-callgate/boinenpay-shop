import { NextRequest } from "next/server";

type LogLevel = "INFO" | "WARN" | "ERROR";

export interface LogContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action?: string;
  path?: string;
  method?: string;
  ip?: string;
  data?: unknown;
}

interface InternalLogPayload extends LogContext {
  ts: string;
  level: LogLevel;
  message: string;
}

function formatLog(level: LogLevel, message: string, context?: LogContext): InternalLogPayload {
  return {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context || {}),
  };
}

function writeLog(level: LogLevel, message: string, context?: LogContext) {
  const payload = formatLog(level, message, context);
  const line = JSON.stringify(payload);

  if (level === "ERROR") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === "WARN") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  info(message: string, context?: LogContext) {
    writeLog("INFO", message, context);
  },
  warn(message: string, context?: LogContext) {
    writeLog("WARN", message, context);
  },
  error(message: string, context?: LogContext) {
    writeLog("ERROR", message, context);
  },
};

export function extractIpFromRequest(req: NextRequest): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return undefined;
}

export function logApiRequest(
  level: LogLevel,
  req: NextRequest,
  context: Omit<LogContext, "method" | "path" | "ip"> = {}
) {
  const ip = extractIpFromRequest(req);
  const { pathname } = req.nextUrl;
  const method = req.method;

  writeLog(level, "admin_api_call", {
    ...context,
    path: pathname,
    method,
    ip,
  });
}


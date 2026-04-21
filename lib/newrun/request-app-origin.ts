import type { NextRequest } from "next/server";

/**
 * var_ret 절대 URL용 앱 origin.
 * - 우선 `NEXT_PUBLIC_APP_URL`
 * - 없으면 요청 Host / X-Forwarded-* (로컬 `localhost:3000` 등)
 */
export function getRequestAppOrigin(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host")?.trim();
  if (!host) return "";

  const protoHeader = request.headers.get("x-forwarded-proto");
  const proto = protoHeader?.split(",")[0]?.trim() || "http";
  return `${proto}://${host}`;
}

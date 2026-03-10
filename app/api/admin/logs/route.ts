import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger, extractIpFromRequest } from "@/lib/logger";

/**
 * 관리자/파트너 액션 로깅용 엔드포인트
 * POST /api/admin/logs
 * - 프론트엔드에서 의미 있는 액션을 서버 콘솔 로그로 전송
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json().catch(() => ({}));

    const ip = extractIpFromRequest(request);
    const path = body.path ?? request.headers.get("x-path") ?? undefined;

    logger.info("admin_front_action", {
      userId: (session?.user as { id?: string } | null)?.id,
      userEmail: session?.user?.email ?? undefined,
      action: body.action ?? body.name,
      path,
      data: {
        payload: body,
        method: request.method,
        ip,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("admin_front_action_log_failed", {
      data: { error: err },
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}


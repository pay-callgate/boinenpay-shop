import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  isDevNewrunAutoSubmitToggleAvailable,
  readDevNewrunAutoSubmitState,
  writeDevNewrunAutoSubmitState,
} from "@/lib/dev-newrun-auto-submit";

/**
 * 개발 전용: 결제 완료 직후 뉴런(우리부고) 자동 발주 on/off.
 * GET: 현재 상태 + 토글 가능 여부
 * POST: { "enabled": boolean }
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const toggleAvailable = isDevNewrunAutoSubmitToggleAvailable();
  const state = readDevNewrunAutoSubmitState();

  return NextResponse.json({
    toggleAvailable,
    autoSubmitEnabled: state.autoSubmitEnabled,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  if (!isDevNewrunAutoSubmitToggleAvailable()) {
    return NextResponse.json(
      { error: "개발 서버(NODE_ENV=development)에서만 토글할 수 있습니다." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled(boolean) 가 필요합니다." }, { status: 400 });
  }
  const enabled = body.enabled;

  try {
    writeDevNewrunAutoSubmitState({ autoSubmitEnabled: enabled });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    autoSubmitEnabled: enabled,
  });
}

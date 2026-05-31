import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import { getViewpaySyncStatus } from "@/lib/viewpay-sync-status";

export const dynamic = "force-dynamic";

const LOG = "[ViewPay:SyncStatus]";

/**
 * GET /api/payment/viewpay/sync-status?orderId=...&sync=1&guestToken=...&sig=...
 * POST body: { orderId, sync?: boolean, cgTid?, guestToken?, paymentSignature? }
 *
 * DB 상태 조회 + (sync=1) ViewPay get-payment-info 교차 검증·finalize 시도
 */
async function handleSyncStatus(request: NextRequest, fromPost: boolean) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id ?? null;

  let orderId = "";
  let guestToken = "";
  let guestSig = "";
  let cgTid = "";
  let doSync = false;

  if (fromPost) {
    const body = await request.json().catch(() => ({}));
    orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    guestToken =
      typeof body.guestToken === "string"
        ? body.guestToken.trim()
        : typeof body.guestCheckoutToken === "string"
          ? body.guestCheckoutToken.trim()
          : "";
    guestSig =
      typeof body.paymentSignature === "string"
        ? body.paymentSignature.trim()
        : typeof body.sig === "string"
          ? body.sig.trim()
          : "";
    cgTid = typeof body.cgTid === "string" ? body.cgTid.trim() : "";
    doSync = body.sync !== false;
  } else {
    const { searchParams } = new URL(request.url);
    orderId = searchParams.get("orderId")?.trim() ?? "";
    guestToken =
      searchParams.get("guestToken")?.trim() ??
      searchParams.get("guestCheckoutToken")?.trim() ??
      "";
    guestSig =
      searchParams.get("sig")?.trim() ??
      searchParams.get("paymentSignature")?.trim() ??
      "";
    cgTid = searchParams.get("cgTid")?.trim() ?? "";
    doSync = searchParams.get("sync") === "1" || searchParams.get("sync") === "true";
  }

  if (!orderId) {
    return NextResponse.json(
      { success: false, status: "unknown", orderId: "", message: "orderId가 필요합니다." },
      { status: 400 }
    );
  }

  logger.info(`${LOG} 요청`, {
    action: "viewpay_sync_status_request",
    data: { orderId, doSync, hasSession: Boolean(sessionUserId), hasGuest: Boolean(guestToken) },
  });

  const supabase = createServerSupabase();
  const { httpStatus, body } = await getViewpaySyncStatus(supabase, {
    orderId,
    sessionUserId,
    guestToken,
    guestSig,
    cgTid,
    doSync,
  });

  if (body.status === "paid") {
    logger.info(`${LOG} paid`, {
      action: "viewpay_sync_status_paid",
      data: { orderId, orderNo: body.orderNo, syncAttempted: body.syncAttempted },
    });
  }

  return NextResponse.json(body, { status: httpStatus });
}

export async function GET(request: NextRequest) {
  try {
    return await handleSyncStatus(request, false);
  } catch (err) {
    logger.error(`${LOG} error`, { action: "viewpay_sync_status_error", data: { error: String((err as Error).message) } });
    return NextResponse.json(
      { success: false, status: "unknown", orderId: "", message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleSyncStatus(request, true);
  } catch (err) {
    logger.error(`${LOG} error`, { action: "viewpay_sync_status_error", data: { error: String((err as Error).message) } });
    return NextResponse.json(
      { success: false, status: "unknown", orderId: "", message: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

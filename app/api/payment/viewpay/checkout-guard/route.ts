import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import { CART_SESSION_COOKIE } from "@/lib/cart-session-cookie";
import {
  buildOrderCompletePath,
  findRecentCheckoutOrder,
  isRecentlyPaidOrder,
} from "@/lib/viewpay-sync-status";

export const dynamic = "force-dynamic";

const LOG = "[ViewPay:CheckoutGuard]";

/**
 * GET /api/payment/viewpay/checkout-guard?clientId=...
 *
 * checkout / guest-order 진입 시: 세션(회원) 또는 장바구니 쿠키(비회원)로
 * 최근 주문 1건 조회 — 직전 paid 이면 complete 경로 반환 (URL에 orderId 노출 없음)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const clientId = new URL(request.url).searchParams.get("clientId")?.trim() ?? "";
    const subdomain = new URL(request.url).searchParams.get("subdomain")?.trim() ?? "";
    const clientSlug = new URL(request.url).searchParams.get("clientSlug")?.trim() ?? "";

    if (!clientId || !subdomain || !clientSlug) {
      return NextResponse.json(
        { shouldRedirect: false, message: "clientId, subdomain, clientSlug가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const sessionUserId = session?.user?.id ?? null;
    const guestCartSessionId = sessionUserId
      ? null
      : request.cookies.get(CART_SESSION_COOKIE)?.value ?? null;

    if (!sessionUserId && !guestCartSessionId) {
      return NextResponse.json({ shouldRedirect: false, paymentStatus: null });
    }

    const order = await findRecentCheckoutOrder(supabase, {
      clientId,
      sessionUserId,
      guestCartSessionId,
    });

    if (!order || !isRecentlyPaidOrder(order)) {
      return NextResponse.json({
        shouldRedirect: false,
        paymentStatus: order?.payment_status ?? null,
      });
    }

    const completePath = buildOrderCompletePath(subdomain, clientSlug, order);

    logger.info(`${LOG} paid 리다이렉트`, {
      action: "viewpay_checkout_guard_redirect",
      data: { orderId: order.id, isGuest: order.is_guest },
    });

    return NextResponse.json({
      shouldRedirect: true,
      paymentStatus: "paid",
      orderId: order.id,
      orderNo: order.order_no,
      completePath,
    });
  } catch (err) {
    logger.error(`${LOG} error`, {
      action: "viewpay_checkout_guard_error",
      data: { error: String((err as Error).message) },
    });
    return NextResponse.json({ shouldRedirect: false }, { status: 500 });
  }
}

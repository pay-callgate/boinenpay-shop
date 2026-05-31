import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createServerSupabase } from "@/lib/supabase/server";
import { CART_SESSION_COOKIE } from "@/lib/cart-session-cookie";
import { signGuestCheckout } from "@/lib/guest-checkout-signature";
import type { CheckoutGuardApiResponse, CheckoutResumeOrder } from "@/lib/viewpay-checkout-context";
import {
  buildOrderCompletePath,
  findRecentCheckoutOrder,
} from "@/lib/viewpay-sync-status";
import { resolveCheckoutGuardScenario } from "@/lib/viewpay-checkout-guard-logic";
import { VIEWPAY_CHECKOUT_GUARD_PENDING_PROBE_ENABLED } from "@/lib/viewpay-checkout-guard-config";

export const dynamic = "force-dynamic";

const LOG = "[ViewPay:CheckoutGuard]";

function buildResumeOrder(
  order: {
    id: string;
    order_no: string;
    total_amount: number;
    is_guest?: boolean | null;
    guest_checkout_token?: string | null;
    orderer_name?: string | null;
    shipping_phone?: string | null;
    shipping_name?: string | null;
    guest_orderer_email?: string | null;
    checkout_cart_item_ids?: string[] | null;
  }
): CheckoutResumeOrder {
  const guestToken = order.guest_checkout_token?.trim() ?? "";
  const buyerName =
    order.orderer_name?.trim() ||
    order.shipping_name?.trim() ||
    "구매자";
  const buyerPhone = order.shipping_phone?.trim() || "";

  const storedCartIds = Array.isArray(order.checkout_cart_item_ids)
    ? order.checkout_cart_item_ids.map((id) => String(id).trim()).filter(Boolean)
    : undefined;

  const resume: CheckoutResumeOrder = {
    id: order.id,
    orderNo: order.order_no,
    totalAmount: Number(order.total_amount),
    isGuest: Boolean(order.is_guest),
    buyerName,
    buyerPhone,
    buyerEmail: order.guest_orderer_email?.trim() || undefined,
    checkoutCartItemIds: storedCartIds?.length ? storedCartIds : undefined,
  };

  if (order.is_guest && guestToken) {
    resume.guestCheckoutToken = guestToken;
    resume.paymentSignature = signGuestCheckout(order.id, guestToken);
  }

  return resume;
}

/**
 * GET /api/payment/viewpay/checkout-guard?clientId=...
 *
 * 세션·쿠키 기준 최근 주문 1건 — pending 선택형 패널 / paid 안내 (자동 리다이렉트 없음)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const clientId = new URL(request.url).searchParams.get("clientId")?.trim() ?? "";
    const subdomain = new URL(request.url).searchParams.get("subdomain")?.trim() ?? "";
    const clientSlug = new URL(request.url).searchParams.get("clientSlug")?.trim() ?? "";

    if (!clientId || !subdomain || !clientSlug) {
      return NextResponse.json(
        {
          scenario: "none",
          paymentStatus: null,
          message: "clientId, subdomain, clientSlug가 필요합니다.",
        } satisfies CheckoutGuardApiResponse & { message?: string },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const sessionUserId = session?.user?.id ?? null;
    const guestCartSessionId = sessionUserId
      ? null
      : request.cookies.get(CART_SESSION_COOKIE)?.value ?? null;

    const hasIdentity = Boolean(sessionUserId || guestCartSessionId);

    if (!hasIdentity) {
      return NextResponse.json({
        scenario: "no_identity",
        paymentStatus: null,
      } satisfies CheckoutGuardApiResponse);
    }

    if (!VIEWPAY_CHECKOUT_GUARD_PENDING_PROBE_ENABLED) {
      return NextResponse.json({
        scenario: "none",
        paymentStatus: null,
      } satisfies CheckoutGuardApiResponse);
    }

    const order = await findRecentCheckoutOrder(supabase, {
      clientId,
      sessionUserId,
      guestCartSessionId,
    });

    const scenario = resolveCheckoutGuardScenario(order, hasIdentity);

    if (scenario === "paid" && order) {
      const completePath = buildOrderCompletePath(subdomain, clientSlug, order);
      logger.info(`${LOG} paid notice`, {
        action: "viewpay_checkout_guard_paid_notice",
        data: { orderId: order.id, isGuest: order.is_guest },
      });
      return NextResponse.json({
        scenario: "paid",
        paymentStatus: "paid",
        order: buildResumeOrder(order),
        completePath,
      } satisfies CheckoutGuardApiResponse);
    }

    if (scenario === "pending" && order) {
      logger.info(`${LOG} pending offer`, {
        action: "viewpay_checkout_guard_pending_offer",
        data: { orderId: order.id, isGuest: order.is_guest },
      });
      return NextResponse.json({
        scenario: "pending",
        paymentStatus: "pending",
        order: buildResumeOrder(order),
      } satisfies CheckoutGuardApiResponse);
    }

    return NextResponse.json({
      scenario: "none",
      paymentStatus: order?.payment_status ?? null,
    } satisfies CheckoutGuardApiResponse);
  } catch (err) {
    logger.error(`${LOG} error`, {
      action: "viewpay_checkout_guard_error",
      data: { error: String((err as Error).message) },
    });
    return NextResponse.json(
      { scenario: "none", paymentStatus: null } satisfies CheckoutGuardApiResponse,
      { status: 500 }
    );
  }
}

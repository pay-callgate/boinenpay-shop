import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyGuestCheckout } from "@/lib/guest-checkout-signature";
import { executeOrderCancel } from "@/lib/orders/execute-order-cancel";

/**
 * POST /api/orders/[id]/cancel
 * 회원: 세션 소유 주문만. 비회원: body.guestCheckoutToken + paymentSignature
 * Body: { reason?: string, guestCheckoutToken?: string, paymentSignature?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const session = await getServerSession(authOptions);
    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : "고객 요청에 의한 취소";
    const guestCheckoutToken =
      typeof body.guestCheckoutToken === "string" ? body.guestCheckoutToken : undefined;
    const paymentSignature =
      typeof body.paymentSignature === "string" ? body.paymentSignature : undefined;

    const supabase = createServerSupabase();

    if (session?.user?.id) {
      const { data: row, error } = await supabase
        .from("orders")
        .select("id, user_id")
        .eq("id", orderId)
        .maybeSingle();
      if (error || !row || row.user_id !== session.user.id) {
        return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
      }
    } else {
      const { data: row, error } = await supabase
        .from("orders")
        .select("id, is_guest, guest_checkout_token")
        .eq("id", orderId)
        .maybeSingle();
      if (error || !row?.is_guest || !row.guest_checkout_token) {
        return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      }
      if (
        !guestCheckoutToken ||
        !paymentSignature ||
        row.guest_checkout_token !== guestCheckoutToken ||
        !verifyGuestCheckout(orderId, guestCheckoutToken, paymentSignature)
      ) {
        return NextResponse.json(
          { error: "비회원 주문 인증이 올바르지 않습니다." },
          { status: 401 }
        );
      }
    }

    const result = await executeOrderCancel(supabase, {
      orderId,
      reason,
      actor: "customer",
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status ?? 400 }
      );
    }

    return NextResponse.json({
      success: true,
      idempotent: result.idempotent === true,
      message: result.idempotent ? "이미 취소된 주문입니다." : "주문이 취소되었습니다.",
    });
  } catch (err) {
    console.error("[api/orders/cancel] POST", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

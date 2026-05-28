import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyGuestPassword } from "@/lib/guest-password";
import { signGuestCheckout } from "@/lib/guest-checkout-signature";
import {
  guestOrdererNameMatches,
  normalizeGuestOrderNo,
} from "@/lib/guest-order-lookup";

export const dynamic = "force-dynamic";

/**
 * 비회원 주문 조회 (주문자명 + 주문번호 + 비회원 비밀번호).
 * POST /api/shop/guest-order-lookup
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const subdomain = String(body.subdomain ?? "").trim();
    const clientSlug = String(body.clientSlug ?? "").trim();
    const orderNoRaw = String(body.orderNo ?? "").trim();
    const ordererName = String(body.ordererName ?? "").trim();
    const guestPassword = String(body.guestPassword ?? "");

    if (!subdomain || !clientSlug || !orderNoRaw || !ordererName || !guestPassword) {
      return NextResponse.json(
        { success: false, error: { message: "모든 항목을 입력해 주세요." } },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { data: partner, error: pErr } = await supabase
      .from("partners")
      .select("id")
      .eq("subdomain", subdomain)
      .maybeSingle();
    if (pErr || !partner) {
      return NextResponse.json(
        { success: false, error: { message: "쇼핑몰을 찾을 수 없습니다." } },
        { status: 404 }
      );
    }

    const { data: client, error: cErr } = await supabase
      .from("clients")
      .select("id")
      .eq("partner_id", partner.id)
      .eq("slug", clientSlug)
      .maybeSingle();
    if (cErr || !client) {
      return NextResponse.json(
        { success: false, error: { message: "거래처를 찾을 수 없습니다." } },
        { status: 404 }
      );
    }

    const wantNo = normalizeGuestOrderNo(orderNoRaw);

    const baseQuery = () =>
      supabase
        .from("orders")
        .select(
          "id, order_no, shipping_name, orderer_name, guest_password_hash, guest_checkout_token, is_guest, client_id"
        )
        .eq("partner_id", partner.id)
        .eq("client_id", client.id)
        .eq("is_guest", true);

    let row =
      (
        await baseQuery().eq("order_no", wantNo).maybeSingle()
      ).data ?? null;

    if (!row && orderNoRaw !== wantNo) {
      row =
        (
          await baseQuery().eq("order_no", orderNoRaw).maybeSingle()
        ).data ?? null;
    }

    if (!row) {
      console.warn("[guest-order-lookup] order_not_found", {
        subdomain,
        clientSlug,
        wantNo,
      });
      return NextResponse.json(
        { success: false, error: { message: "일치하는 주문이 없거나 비밀번호가 올바르지 않습니다." } },
        { status: 401 }
      );
    }

    if (!guestOrdererNameMatches(row.orderer_name, row.shipping_name, ordererName)) {
      console.warn("[guest-order-lookup] name_mismatch", {
        orderId: row.id,
        wantNo,
      });
      return NextResponse.json(
        { success: false, error: { message: "일치하는 주문이 없거나 비밀번호가 올바르지 않습니다." } },
        { status: 401 }
      );
    }

    if (!row.guest_password_hash || !verifyGuestPassword(guestPassword, row.guest_password_hash)) {
      console.warn("[guest-order-lookup] password_mismatch", {
        orderId: row.id,
        wantNo,
        hasHash: Boolean(row.guest_password_hash),
      });
      return NextResponse.json(
        { success: false, error: { message: "일치하는 주문이 없거나 비밀번호가 올바르지 않습니다." } },
        { status: 401 }
      );
    }

    const guestToken = row.guest_checkout_token;
    if (!guestToken || typeof guestToken !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "주문 정보를 불러올 수 없습니다. 고객센터로 문의해 주세요." } },
        { status: 500 }
      );
    }

    const sig = signGuestCheckout(row.id, guestToken);
    return NextResponse.json({
      success: true,
      data: {
        orderId: row.id,
        guestToken,
        sig,
        subdomain,
        clientSlug,
      },
    });
  } catch (e) {
    console.error("[guest-order-lookup]", e);
    return NextResponse.json(
      { success: false, error: { message: "서버 오류" } },
      { status: 500 }
    );
  }
}

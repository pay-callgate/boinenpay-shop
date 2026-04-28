import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { mapOrderToNewrunPayload } from "@/lib/newrun/map-order-to-newrun-payload";
import { getNewrunCredentialsFromEnv } from "@/lib/newrun/submit-order";
import {
  mergeFloristDraftForOrder,
  mergeProductDraftForOrder,
} from "@/lib/newrun/merge-order-drafts";

/**
 * 파트너 어드민: 뉴런 intranet_post 예상 폼 필드 미리보기 (Phase 4)
 * GET /api/partner/orders/[id]/newrun-preview
 * - 비밀번호는 응답에서 마스킹
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id: orderId } = await params;
    const supabase = createServerSupabase();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        *,
        client:clients (
          id,
          newrun_default_florist_draft
        )
      `
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", order.partner_id)
      .maybeSingle();

    if (!admin) {
      return NextResponse.json({ error: "해당 주문에 대한 조회 권한이 없습니다." }, { status: 403 });
    }

    const { data: items } = await supabase
      .from("order_items")
      .select(
        `
        quantity,
        product_name,
        product:products (
          newrun_default_product_draft,
          newrun_default_option_draft
        )
      `
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    const rowItems = items ?? [];
    const first = rowItems[0]?.product as
      | {
          newrun_default_product_draft?: Record<string, unknown> | null;
          newrun_default_option_draft?: Record<string, unknown> | null;
        }
      | null
      | undefined;

    const florist = mergeFloristDraftForOrder(
      order.client?.newrun_default_florist_draft as Record<string, unknown> | null | undefined,
      order.newrun_florist_draft as Record<string, unknown> | null | undefined
    );
    const product = mergeProductDraftForOrder(
      first?.newrun_default_product_draft,
      order.newrun_product_draft as Record<string, unknown> | null | undefined
    );
    const option = mergeProductDraftForOrder(
      first?.newrun_default_option_draft,
      order.newrun_option_draft as Record<string, unknown> | null | undefined
    );

    const creds =
      getNewrunCredentialsFromEnv() ?? {
        rw_rosewebid: "",
        rw_rosewebpw: "",
        rw_assoc: "",
        rw_returnurl: "",
      };

    const result = mapOrderToNewrunPayload(
      {
        id: order.id,
        order_no: order.order_no,
        payment_status: order.payment_status,
        total_amount: order.total_amount,
        shipping_name: order.shipping_name,
        shipping_phone: order.shipping_phone,
        shipping_postcode: order.shipping_postcode,
        shipping_address: order.shipping_address,
        shipping_detail: order.shipping_detail,
        created_at: order.created_at,
        desired_delivery_date: (order as { desired_delivery_date?: string | null }).desired_delivery_date ?? null,
      },
      rowItems.map((i) => ({
        quantity: i.quantity,
        product_name: i.product_name,
      })),
      { florist, product, option },
      creds,
      { strict: false, headquartersBonbalju: true, rw_method: "1" }
    );

    const masked = {
      ...result.fields,
      rw_rosewebpw: result.fields.rw_rosewebpw ? "***" : "",
    };

    return NextResponse.json({
      fields: masked,
      warnings: result.warnings,
      blockingIssues: result.blockingIssues ?? [],
      envHints: {
        NEWRUN_ASSOC_INTRANET_ID: Boolean(process.env.NEWRUN_ASSOC_INTRANET_ID?.trim()),
        NEWRUN_ROSEWEB_PW: Boolean(process.env.NEWRUN_ROSEWEB_PW?.trim()),
        NEWRUN_ASSOC_CODE: Boolean(process.env.NEWRUN_ASSOC_CODE?.trim()),
        NEWRUN_RW_RETURNURL: Boolean(process.env.NEWRUN_RW_RETURNURL?.trim()),
      },
    });
  } catch (err) {
    console.error("newrun-preview GET error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

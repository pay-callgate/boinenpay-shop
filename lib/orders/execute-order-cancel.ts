import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { recordOrderPartnerNotifyEventSafe } from "@/lib/order-partner-notify-events";
import { viewpayCancelFullPayment } from "@/lib/viewpay-cancel-payment";
import {
  canCustomerRequestCancel,
  canPartnerAdminCancelOrder,
  type OrderRowForCancelEligibility,
} from "@/lib/orders/cancel-eligibility";

const LOG = "[Orders:Cancel]";

type OrderCancelRow = OrderRowForCancelEligibility & {
  id: string;
  partner_id: string;
  order_no: string | null;
  cg_tid?: string | null;
  viewpay_merchant_order_no?: string | null;
};

export type ExecuteOrderCancelActor = "customer" | "partner";

export async function executeOrderCancel(
  supabase: SupabaseClient,
  opts: {
    orderId: string;
    reason: string;
    actor: ExecuteOrderCancelActor;
  }
): Promise<
  | { ok: true; idempotent?: boolean }
  | { ok: false; code: string; message: string; status?: number }
> {
  const reason = String(opts.reason ?? "").trim() || "콜링크 쇼핑몰 주문 취소";

  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select(
      "id, partner_id, order_no, payment_status, status, cg_tid, viewpay_merchant_order_no, newrun_delivery_info"
    )
    .eq("id", opts.orderId)
    .maybeSingle();

  if (fetchErr || !order) {
    return { ok: false, code: "not_found", message: "주문을 찾을 수 없습니다.", status: 404 };
  }

  const row = order as OrderCancelRow;

  if (row.payment_status === "refunded" && row.status === "cancelled") {
    return { ok: true, idempotent: true };
  }

  const eligibility =
    opts.actor === "customer"
      ? canCustomerRequestCancel(row)
      : canPartnerAdminCancelOrder(row);
  if (!eligibility.ok) {
    return {
      ok: false,
      code: eligibility.code,
      message: eligibility.message,
      status: 403,
    };
  }

  const cgTid = String(row.cg_tid ?? "").trim();
  if (!cgTid) {
    return {
      ok: false,
      code: "no_cg_tid",
      message: "결제 거래 ID(cg_tid)가 없어 PG 취소를 진행할 수 없습니다. 고객센터로 문의해 주세요.",
      status: 400,
    };
  }

  const orderNoFallback = String(
    row.viewpay_merchant_order_no ?? row.order_no ?? ""
  ).trim();

  try {
    await viewpayCancelFullPayment({
      cgTid,
      orderNoFallback: orderNoFallback || undefined,
      reason,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`${LOG} ViewPay 취소 실패`, {
      action: "order_cancel_viewpay_failed",
      data: { orderId: opts.orderId, error: msg },
    });
    return {
      ok: false,
      code: "viewpay_cancel_failed",
      message: msg || "결제 취소에 실패했습니다.",
      status: 502,
    };
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update({
      payment_status: "refunded",
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.orderId);

  if (updErr) {
    logger.error(`${LOG} orders 반영 실패(ViewPay 취소는 완료됨)`, {
      action: "order_cancel_db_failed_after_viewpay",
      data: { orderId: opts.orderId, message: updErr.message },
    });
    return {
      ok: false,
      code: "db_update_failed",
      message:
        "결제 취소는 완료되었으나 주문 상태 반영에 실패했습니다. 운영자에게 연락해 주세요.",
      status: 500,
    };
  }

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", opts.orderId);

  if (orderItems?.length) {
    for (const item of orderItems) {
      const { data: product } = await supabase
        .from("products")
        .select("stock_qty, status")
        .eq("id", item.product_id)
        .single();

      if (product) {
        const restoredStockQty = (product.stock_qty || 0) + item.quantity;
        const restoreData: { stock_qty: number; status?: string } = { stock_qty: restoredStockQty };
        if (restoredStockQty > 0 && product.status === "sold_out") {
          restoreData.status = "active";
        }
        const { error: stockError } = await supabase
          .from("products")
          .update(restoreData)
          .eq("id", item.product_id);
        if (stockError) {
          logger.warn(`${LOG} 재고 복구 실패(무시)`, {
            action: "order_cancel_stock_restore_warn",
            data: { productId: item.product_id, message: stockError.message },
          });
        }
      }
    }
  }

  await supabase.from("order_status_history").insert({
    order_id: opts.orderId,
    status: "cancelled",
    memo:
      opts.actor === "customer"
        ? `고객 주문 취소 · ${reason}`
        : `파트너 결제 취소 · ${reason}`,
  });

  await supabase
    .from("payments")
    .update({
      status: "refunded",
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", opts.orderId)
    .eq("status", "completed");

  await recordOrderPartnerNotifyEventSafe(supabase, {
    orderId: opts.orderId,
    partnerId: row.partner_id,
    kind: "order_cancelled",
    source: opts.actor === "customer" ? "customer_order_cancel_api" : "partner_order_cancel_api",
    payload: { reason, previousPaymentStatus: row.payment_status, previousStatus: row.status },
  });

  logger.info(`${LOG} 완료`, {
    action: "order_cancel_success",
    data: { orderId: opts.orderId, actor: opts.actor },
  });

  return { ok: true };
}

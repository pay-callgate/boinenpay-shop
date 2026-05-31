import { toDesiredDeliveryYmd } from "@/lib/admin-florist-order-display";

/** GET /api/orders/[id] 응답 order → checkout 폼 hydrate */
export type PendingOrderFormSnapshot = {
  ordererName: string;
  ordererPhone: string;
  shippingName: string;
  shippingPhone: string;
  shippingPostcode: string;
  shippingAddress: string;
  venueDetail: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  ribbonSender: string;
  ribbonMessage: string;
};

function parseVenueFromShippingDetail(detail: string | null | undefined): string {
  if (!detail?.trim()) return "";
  const first = detail.split("\n")[0]?.trim() ?? "";
  if (!first || first.startsWith("[")) return "";
  return first;
}

export function extractPendingOrderFormSnapshot(
  order: Record<string, unknown>
): PendingOrderFormSnapshot {
  const shippingDetail =
    typeof order.shipping_detail === "string" ? order.shipping_detail : "";
  const desiredYmd = toDesiredDeliveryYmd(
    (order.desired_delivery_date as string | null | undefined) ?? null
  );

  return {
    ordererName: String(order.orderer_name ?? "").trim(),
    ordererPhone: String(order.shipping_phone ?? "").trim(),
    shippingName: String(order.shipping_name ?? "").trim(),
    shippingPhone: String(order.shipping_phone ?? "").trim(),
    shippingPostcode: String(order.shipping_postcode ?? "").trim(),
    shippingAddress: String(order.shipping_address ?? "").trim(),
    venueDetail: parseVenueFromShippingDetail(shippingDetail),
    deliveryDate: desiredYmd || "",
    deliveryTimeSlot: String(order.delivery_time_slot ?? "").trim() || "14:00~16:00",
    ribbonSender: String(order.ribbon_sender ?? "").trim(),
    ribbonMessage: String(order.ribbon_message ?? "").trim(),
  };
}

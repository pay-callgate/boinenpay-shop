"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  Coins,
  CreditCard,
  MapPin,
  MessageSquare,
  User,
} from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { OrderDetailInfoRow } from "@/components/shop/OrderDetailInfoRow";
import { OrderDetailSectionCard } from "@/components/shop/OrderDetailSectionCard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { shopFetch } from "@/lib/shop-fetch";
import { assignLocationHrefForPayment } from "@/lib/kakao-in-app-browser";
import { confirmKakaoExternalPaymentIfNeeded } from "@/lib/confirm-kakao-external-payment-client";
import { toast } from "@/components/shop/ToastContext";
import { OrderProgressStepper } from "@/components/shop/OrderProgressStepper";
import {
  shopOrderCustomerBadge,
  shopOrderProgressStepIndex,
} from "@/lib/shop/customer-order-fulfillment";
import { shopOrderDetailBadgeStatus, shopPaymentStatusLabel } from "@/lib/shop/order-status-labels";
import {
  formatDesiredDeliveryDateTimeLine,
  getAdminLocalTodayYmd,
  isDesiredDeliveryToday,
} from "@/lib/admin-florist-order-display";
import {
  formatFloristShippingAddressForCustomerUI,
  parseFloristMetaFromShippingDetail,
} from "@/lib/checkout-florist-fields";

const PRIMARY = "#D6A8E0";

function formatPaymentMethodLabel(method: string | null | undefined): string {
  const m = (method ?? "").trim().toLowerCase();
  if (m === "card") return "신용·체크카드";
  if (m === "bank" || m === "transfer") return "무통장입금";
  if (!m) return "—";
  return method ?? "—";
}

function paymentStatusBadgeClass(paymentStatus: string): string {
  switch (paymentStatus) {
    case "paid":
      return "text-emerald-600 bg-emerald-50";
    case "pending":
      return "text-amber-700 bg-amber-50";
    case "failed":
      return "text-red-600 bg-red-50";
    case "refunded":
      return "text-gray-600 bg-gray-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
}

function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)} 원`;
}

/**
 * T6-2: 마이페이지 주문 상세
 * /{subdomain}/{clientSlug}/mypage/orders/[id]
 * partner/client는 ShopTemplateContext에서 사용.
 */

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  option_json: Record<string, string> | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnail_url: string | null;
  };
}

interface Client {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface OrderUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface Order {
  id: string;
  order_no: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_postcode: string | null;
  shipping_address: string;
  shipping_detail: string | null;
  tracking_number: string | null;
  courier_company: string | null;
  created_at: string;
  paid_at?: string | null;
  /** 고객 API 전용: `newrun_delivery_info.dica`만 추출 */
  delivery_photo_url?: string | null;
  desired_delivery_date?: string | null;
  delivery_time_slot?: string | null;
  delivery_method?: string | null;
  delivery_request_memo?: string | null;
  ribbon_sender?: string | null;
  ribbon_message?: string | null;
  client: Client;
  user?: OrderUser | null;
}

export default function MyOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;

  const searchParams = useSearchParams();
  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const orderId = params?.id as string;
  const guestToken = searchParams?.get("guestToken") ?? "";
  const guestSig = searchParams?.get("sig") ?? "";
  const guestMode = Boolean(guestToken && guestSig);

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [cancelGuideOpen, setCancelGuideOpen] = useState(false);

  const orderApiUrl =
    guestMode && guestToken && guestSig
      ? `/api/orders/${orderId}?guestToken=${encodeURIComponent(guestToken)}&sig=${encodeURIComponent(guestSig)}`
      : `/api/orders/${orderId}`;

  // 주문 상세 조회 (Context 준비 후 실행)
  useEffect(() => {
    if (!orderId || !partner?.id || !client?.id) return;
    let cancelled = false;
    setLoading(true);
    shopFetch(orderApiUrl, { handleSessionExpiry: !guestMode })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.order) {
          setOrder(data.order);
          setItems(data.items ?? []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, partner?.id, client?.id, orderApiUrl, guestMode]);

  // Phase F1: 결제창에서 취소 후 cancelUrl로 돌아온 경우
  useEffect(() => {
    if (searchParams?.get("cancel") === "1") {
      console.debug("[Order:Mypage] ViewPay 결제 취소 후 cancelUrl 복귀", { orderId });
      toast("결제가 취소되었습니다. 주문은 유지됩니다. 아래 [결제하기]로 다시 시도할 수 있습니다.", "error");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("cancel");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
  }, [searchParams]);

  // 가격 포맷팅
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ko-KR").format(price);
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Phase F1: 미결제 주문 재결제 (ViewPay prepare → 결제창 리다이렉트)
  const handlePayNow = async () => {
    if (!order || order.payment_status !== "pending" || paymentSubmitting) return;
    const buyerName = (order.user?.name || order.shipping_name || "").trim();
    const buyerPhone = (order.user?.phone || order.shipping_phone || "").trim();
    const buyerEmail = (order.user?.email || "").trim() || "noreply@callgate.com";
    if (!buyerName || !buyerPhone) {
      toast("결제자 정보가 없습니다. 배송지 정보로 결제를 시도합니다.", "error");
    }
    setPaymentSubmitting(true);
    console.debug("[Order:Mypage] 재결제 prepare 요청", { orderId: order.id, order_no: order.order_no, amount: order.total_amount });
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const returnUrl = `${origin}/${subdomain}/${clientSlug}/order/complete?orderId=${order.id}`;
      const cancelUrl = `${origin}/${subdomain}/${clientSlug}/mypage/orders/${order.id}?cancel=1`;
      const productName = items.length > 0 ? items[0].product_name : "주문상품";
      const res = await shopFetch("/api/payment/viewpay/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNo: order.order_no,
          amount: order.total_amount,
          productName,
          returnUrl,
          cancelUrl,
          buyerName: buyerName || order.shipping_name,
          buyerPhone: buyerPhone || order.shipping_phone,
          buyerEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.redirectUrl) {
        const confirmed = await confirmKakaoExternalPaymentIfNeeded();
        if (!confirmed) return;
        console.debug("[Order:Mypage] ViewPay redirect 이동", { orderId: order.id });
        assignLocationHrefForPayment(String(data.redirectUrl));
        return;
      }
      console.debug("[Order:Mypage] prepare 실패", { ok: res.ok, message: data.message });
      toast(data.message || "결제창을 열 수 없습니다.", "error");
    } catch (e) {
      console.debug("[Order:Mypage] prepare 예외", e);
      toast((e as Error)?.message || "결제 요청에 실패했습니다.", "error");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleCancelGuideOpen = () => {
    if (!order) return;
    setCancelGuideOpen(true);
  };
  if (template == null || !partner || !client) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F5F5",
        }}
      >
        <p style={{ color: "#666" }}></p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F5F5",
        }}
      >
        <p style={{ color: "#666" }}></p>
      </div>
    );
  }

  if (!order) {
    return (
      <OrderGuard
        partnerId={partner.id}
        shopClientId={client?.id}
        shopClientName={client?.name ?? undefined}
        requireAuth={!guestMode}
        blockAffiliationMismatch={!guestMode}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F5F5F5",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "8px" }}>
            주문을 찾을 수 없습니다
          </h1>
          <button
            onClick={() => router.push(`/${subdomain}/${clientSlug}/mypage/orders`)}
            style={{
              marginTop: "16px",
              padding: "12px 24px",
              backgroundColor: "#D6A8E0",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            주문 목록으로
          </button>
        </div>
      </OrderGuard>
    );
  }

  const detailBadge = shopOrderDetailBadgeStatus({
    status: order.status,
    payment_status: order.payment_status,
  });
  const customerBadge = shopOrderCustomerBadge({
    status: order.status,
    payment_status: order.payment_status,
    paid_at: order.paid_at,
    created_at: order.created_at,
    desired_delivery_date: order.desired_delivery_date,
  });
  const progressStepIndex = shopOrderProgressStepIndex({
    status: order.status,
    payment_status: order.payment_status,
    paid_at: order.paid_at,
    created_at: order.created_at,
    desired_delivery_date: order.desired_delivery_date,
  });

  const showCancelGuideButton =
    order.status !== "delivered" &&
    order.status !== "cancelled" &&
    order.payment_status !== "refunded";

  const parsedDetail = parseFloristMetaFromShippingDetail(order.shipping_detail);
  const deliveryLine =
    formatDesiredDeliveryDateTimeLine(
      order.desired_delivery_date,
      order.delivery_time_slot
    ) ||
    parsedDetail.deliveryHopeLine ||
    "—";
  const shopToday = getAdminLocalTodayYmd();
  const deliveryIsToday = isDesiredDeliveryToday(order.desired_delivery_date, shopToday);
  const streetAddress = formatFloristShippingAddressForCustomerUI(
    order.shipping_address,
    order.shipping_detail
  );
  const addressDisplay = [
    order.shipping_postcode?.trim() ? `[${order.shipping_postcode.trim()}]` : null,
    streetAddress || order.shipping_address,
  ]
    .filter(Boolean)
    .join(" ");
  const receiverLine = `${order.shipping_name || "—"} (${order.shipping_phone || "—"})`;
  const ribbonMsg =
    order.ribbon_message?.trim() ||
    parsedDetail.ribbonMessage ||
    parsedDetail.ribbonCard ||
    "";
  const ribbonFrom = order.ribbon_sender?.trim() || parsedDetail.ribbonSender || "";
  const itemsTotal = items.reduce((sum, i) => sum + Number(i.total_price), 0);
  const orderTotal = Number(order.total_amount);
  const shippingFee = orderTotal >= itemsTotal ? orderTotal - itemsTotal : 0;
  const discountAmount = orderTotal < itemsTotal ? itemsTotal - orderTotal : 0;
  const paymentMethodLabel = formatPaymentMethodLabel(order.payment_method);
  const paymentStatusLabel = shopPaymentStatusLabel(order.payment_status);

  return (
    <OrderGuard
      partnerId={partner.id}
      shopClientId={client?.id}
      shopClientName={client?.name ?? undefined}
      requireAuth={!guestMode}
      blockAffiliationMismatch={!guestMode}
    >
      <div className="mx-auto min-h-[100vh] max-w-[430px] bg-gray-50 pb-8 break-keep [word-break:keep-all]">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100"
            aria-label="뒤로 가기"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <h1 className="flex-1 text-lg font-bold text-gray-900">주문 상세</h1>
        </header>

        <div className="px-4 pt-4">
          <OrderDetailSectionCard title="주문 진행" className="text-center">
            <OrderProgressStepper activeIndex={progressStepIndex} />
            <p className="mt-2 text-center text-xs text-gray-400">
              * 본 진행 상태는 예상 스케줄 안내용이며, 실제 제작 및 배송 현황과 다소 차이가 있을 수 있습니다.
            </p>
            <span className="mt-4 inline-block rounded-full border border-pink-200 bg-pink-100 px-5 py-2 text-sm font-bold text-pink-600">
              {customerBadge.label}
            </span>
            {detailBadge.showPaymentBeforeFulfillmentNote ? (
              <p className="mx-auto mt-3 max-w-sm rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-left text-xs leading-relaxed text-amber-900">
                아직 <strong>결제가 완료되지 않은</strong> 주문입니다. 결제를 마치면 배송 준비 단계로
                진행됩니다.
              </p>
            ) : null}
            <p className="mt-4 text-sm text-gray-600">주문번호: {order.order_no}</p>
            <p className="mt-1 text-xs text-gray-400">{formatDate(order.created_at)}</p>
          </OrderDetailSectionCard>

          <OrderDetailSectionCard title="주문 상품">
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {item.product.thumbnail_url ? (
                      <img
                        src={item.product.thumbnail_url}
                        alt={item.product_name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-gray-900">
                      {item.product_name}
                    </p>
                    {item.option_json ? (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {Object.entries(item.option_json)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(", ")}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-sm text-gray-600">
                      {formatPrice(item.unit_price)}원 × {item.quantity}개
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </OrderDetailSectionCard>

          <section className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <h3 className="flex items-center text-lg font-bold text-gray-900 before:mr-2 before:block before:h-4 before:w-1 before:rounded-full before:bg-pink-400 before:content-['']">
                결제 정보 Summary
              </h3>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${paymentStatusBadgeClass(order.payment_status)}`}
              >
                {paymentStatusLabel}
              </span>
            </div>

            <div className="mb-6 flex items-center">
              <div className="mr-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-500">
                <Coins className="h-6 w-6" strokeWidth={2} aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">최종 결제 금액</p>
                <p className="mt-1 text-base font-bold text-gray-900">
                  {formatWon(Number(order.total_amount))}
                </p>
              </div>
            </div>

            <div className="mb-6 flex items-center">
              <div className="mr-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-500">
                <CreditCard className="h-6 w-6" strokeWidth={2} aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">결제 수단</p>
                <p className="mt-1 text-base font-bold text-gray-900">{paymentMethodLabel}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3.5 rounded-2xl bg-gray-50 p-5">
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-gray-600">주문 상품 금액</span>
                <span className="font-medium text-gray-900">{formatWon(itemsTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-[15px]">
                <span className="flex items-center gap-2 text-gray-600">
                  배송비
                  {deliveryIsToday ? (
                    <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[11px] font-bold text-pink-600">
                      당일배송
                    </span>
                  ) : null}
                </span>
                <span className="font-medium text-gray-900">
                  {shippingFee <= 0 ? "무료" : formatWon(shippingFee)}
                </span>
              </div>
              {discountAmount > 0 ? (
                <div className="flex items-center justify-between text-[15px]">
                  <span className="font-bold text-pink-600">특별 할인 혜택</span>
                  <span className="font-bold text-pink-600">
                    -{new Intl.NumberFormat("ko-KR").format(discountAmount)} 원
                  </span>
                </div>
              ) : null}
            </div>

            {order.payment_status === "pending" && (
              <button
                type="button"
                onClick={handlePayNow}
                disabled={paymentSubmitting}
                className="mt-6 w-full rounded-xl py-3.5 text-base font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: PRIMARY }}
              >
                결제하기
              </button>
            )}
          </section>

          <OrderDetailSectionCard title="배송 및 제작 정보">
            <div className="flex flex-col gap-5">
              <OrderDetailInfoRow icon={Calendar} label="배송 희망일" valueBold>
                {deliveryIsToday ? (
                  <span className="mr-1.5 inline-block rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    오늘
                  </span>
                ) : null}
                {deliveryLine}
              </OrderDetailInfoRow>
              <OrderDetailInfoRow icon={User} label="수령인">
                {receiverLine}
              </OrderDetailInfoRow>
              <OrderDetailInfoRow icon={MapPin} label="배송 주소">
                {addressDisplay || "—"}
              </OrderDetailInfoRow>
              <OrderDetailInfoRow icon={MessageSquare} label="리본 문구(경조사어)" valueBold>
                {ribbonMsg ? <span>&ldquo;{ribbonMsg}&rdquo;</span> : "—"}
              </OrderDetailInfoRow>
              <OrderDetailInfoRow icon={User} label="리본 문구(보내는 분)">
                {ribbonFrom || "—"}
              </OrderDetailInfoRow>
            </div>
            {order.delivery_request_memo?.trim() ? (
              <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
                <span className="font-medium text-gray-500">배송 요청: </span>
                {order.delivery_request_memo.trim()}
              </p>
            ) : null}
          </OrderDetailSectionCard>

          {showCancelGuideButton ? (
            <button
              type="button"
              onClick={handleCancelGuideOpen}
              className="mt-6 w-full rounded-2xl border border-pink-200 bg-white py-4 text-[15px] font-medium text-gray-600 transition-colors hover:bg-pink-50"
            >
              주문 취소 안내
            </button>
          ) : null}
        </div>
      </div>

      {cancelGuideOpen && order && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setCancelGuideOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-guide-dialog-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "340px",
              backgroundColor: "#fff",
              borderRadius: "16px",
              padding: "24px 20px 20px",
              boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
            }}
          >
            <h2
              id="cancel-guide-dialog-title"
              style={{
                margin: "0 0 16px",
                fontSize: "1.05rem",
                fontWeight: 800,
                color: "#111827",
                letterSpacing: "-0.02em",
              }}
            >
              주문 취소 안내
            </h2>
            <div
              style={{
                margin: "0 0 20px",
                fontSize: "0.9rem",
                color: "#374151",
                lineHeight: 1.65,
                whiteSpace: "pre-line",
              }}
            >
              <p style={{ margin: "0 0 12px" }}>
                생화 상품 특성상 결제 후 1시간 이내에만 고객센터를 통해 취소가 가능합니다.
              </p>
              <p style={{ margin: "0 0 12px", fontWeight: 600 }}>
                📞 고객센터:{" "}
                <a
                  href="tel:1661-1897"
                  style={{ color: "#7C3AED", textDecoration: "underline", fontWeight: 700 }}
                >
                  1661-1897
                </a>
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.1rem",
                  listStyleType: "disc",
                  fontSize: "0.85rem",
                  color: "#4B5563",
                }}
              >
                <li style={{ marginBottom: "6px" }}>
                  배송 출발 이후: 발생한 배송비를 제외하고 환불됩니다.
                </li>
                <li style={{ marginBottom: "6px" }}>
                  배송 완료 이후: 주문 취소 및 환불이 불가합니다.
                </li>
                <li>
                  영업시간 외: 문자로 &apos;주문자 성함&apos;과 &apos;취소 요청&apos;을 남겨주시면
                  익일 오전 처리해 드립니다.
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setCancelGuideOpen(false)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                backgroundColor: "#D6A8E0",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </OrderGuard>
  );
}

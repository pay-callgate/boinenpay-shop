"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { shopFetch } from "@/lib/shop-fetch";
import { assignLocationHrefForPayment } from "@/lib/kakao-in-app-browser";
import { toast } from "@/components/shop/ToastContext";
import { formatTrackingDisplay } from "@/lib/courier";
import {
  shopOrderDetailBadgeStatus,
  shopOrderStatusColor,
  shopOrderStatusLabel,
  shopPaymentStatusLabel,
} from "@/lib/shop/order-status-labels";
import {
  formatAdminDeliveryMethod,
  formatDesiredDeliveryDateTimeLine,
  getAdminLocalTodayYmd,
  isDesiredDeliveryToday,
} from "@/lib/admin-florist-order-display";

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
          maxWidth: "430px",
          margin: "0 auto",
          minHeight: "100vh",
          backgroundColor: "#F5F5F5",
          paddingBottom: "24px",
        }}
      >
        {/* 헤더 */}
        <header
          style={{
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "#fff",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="#333"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, flex: 1 }}>
            주문 상세
          </h1>
        </header>

        {/* 주문 상태 */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "20px 16px",
            marginBottom: "12px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "8px 20px",
              borderRadius: "20px",
              fontSize: "1rem",
              fontWeight: 700,
              backgroundColor: `${shopOrderStatusColor(detailBadge.statusKey)}20`,
              color: shopOrderStatusColor(detailBadge.statusKey),
              marginBottom: "12px",
            }}
          >
            {shopOrderStatusLabel(detailBadge.statusKey)}
          </span>
          {detailBadge.showPaymentBeforeFulfillmentNote ? (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#B45309",
                backgroundColor: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: "8px",
                padding: "10px 12px",
                marginBottom: "12px",
                lineHeight: 1.5,
                textAlign: "left",
                maxWidth: "320px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              아직 <strong>결제가 완료되지 않은</strong> 주문입니다. 결제를 마치면 배송 준비 단계로
              진행됩니다. (시스템에 등록된 주문 단계와 결제 상태가 잠시 어긋난 경우에도 안내와 같이
              결제를 우선해 주세요.)
            </p>
          ) : null}
          <p style={{ fontSize: "0.875rem", color: "#666" }}>
            주문번호: {order.order_no}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "4px" }}>
            {formatDate(order.created_at)}
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              color: "#6B7280",
              marginTop: "12px",
              lineHeight: 1.5,
              textAlign: "left",
              maxWidth: "320px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            화환·꽃 배달 등은 택배가 아닌 경우 송장 번호 없이 진행될 수 있습니다. 상태는 주문 처리
            단계에 맞게 갱신됩니다.
          </p>
        </div>

        {/* 배송 추적 */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "12px" }}>
            배송 추적
          </h2>
          {order.tracking_number ? (
            <>
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                }}
              >
                <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "4px" }}>
                  송장번호
                </p>
                <p style={{ fontSize: "1rem", fontWeight: 600 }}>
                  {formatTrackingDisplay(order.courier_company, order.tracking_number)}
                </p>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "8px", textAlign: "center" }}>
                택배사 배송 추적 API 연동은 향후 구현 예정입니다.
              </p>
            </>
          ) : (
            <p style={{ fontSize: "0.875rem", color: "#666", lineHeight: 1.6 }}>
              등록된 택배 송장이 없습니다. 배달 상품은 업체 직배송으로 진행되거나, 준비 후 송장이
              올라올 수 있습니다.
            </p>
          )}
          {order.delivery_photo_url ? (
            <div style={{ marginTop: "16px", textAlign: "center" }}>
              <a
                href={order.delivery_photo_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "12px 20px",
                  backgroundColor: "#D6A8E0",
                  color: "#fff",
                  borderRadius: "12px",
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                배송 완료 사진 보기
              </a>
              <p style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: "8px" }}>
                새 창에서 배송 확인 이미지가 열립니다.
              </p>
            </div>
          ) : null}
        </div>

        {/* 주문 항목 */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "12px" }}>
            주문 상품
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    flexShrink: 0,
                    backgroundColor: "#F3F4F6",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  {item.product.thumbnail_url && (
                    <img
                      src={item.product.thumbnail_url}
                      alt={item.product_name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "4px" }}>
                    {item.product_name}
                  </p>
                  {item.option_json && (
                    <p style={{ fontSize: "0.8125rem", color: "#666", marginBottom: "4px" }}>
                      {Object.entries(item.option_json)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(", ")}
                    </p>
                  )}
                  <p style={{ fontSize: "0.875rem", color: "#666" }}>
                    {formatPrice(item.unit_price)}원 × {item.quantity}개
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 배송지 정보 */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "12px" }}>
            배송지 정보
          </h2>
          <div style={{ fontSize: "0.875rem", lineHeight: "1.6" }}>
            <p style={{ marginBottom: "4px" }}>
              <span style={{ color: "#666" }}>받는 분: </span>
              <span style={{ fontWeight: 600 }}>{order.shipping_name}</span>
            </p>
            <p style={{ marginBottom: "4px" }}>
              <span style={{ color: "#666" }}>연락처: </span>
              {order.shipping_phone}
            </p>
            <p>
              <span style={{ color: "#666" }}>주소: </span>
              {order.shipping_postcode && `[${order.shipping_postcode}] `}
              {order.shipping_address}
              {order.shipping_detail && `, ${order.shipping_detail}`}
            </p>
          </div>
        </div>

        {/* 화훼: 희망 배달·리본 — 항상 이 위치(배송지 아래)에서 확인 */}
        {(() => {
          const o = order;
          const hasFlorist =
            (o.desired_delivery_date != null && String(o.desired_delivery_date).trim() !== "") ||
            (o.delivery_time_slot != null && String(o.delivery_time_slot).trim() !== "") ||
            (o.delivery_method != null && String(o.delivery_method).trim() !== "") ||
            (o.delivery_request_memo != null && String(o.delivery_request_memo).trim() !== "") ||
            (o.ribbon_sender != null && String(o.ribbon_sender).trim() !== "") ||
            (o.ribbon_message != null && String(o.ribbon_message).trim() !== "");
          const deliveryLine = formatDesiredDeliveryDateTimeLine(
            o.desired_delivery_date,
            o.delivery_time_slot
          );
          const shopToday = getAdminLocalTodayYmd();
          const deliveryIsToday = isDesiredDeliveryToday(o.desired_delivery_date, shopToday);
          return (
            <div
              style={{
                backgroundColor: "#FFF5F7",
                padding: "16px",
                marginBottom: "12px",
                borderRadius: "8px",
                border: "1px solid #FBCFE8",
              }}
            >
              <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "4px", color: "#831843" }}>
                배달·리본 정보
              </h2>
              <p style={{ fontSize: "0.75rem", color: "#9D174D", marginBottom: "12px", lineHeight: 1.45 }}>
                마이페이지에서는 <strong>배송지 정보 바로 아래</strong>에서 희망 배송일·시간과 리본 문구를
                확인할 수 있습니다.
              </p>
              {!hasFlorist ? (
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "#6B7280",
                    lineHeight: 1.6,
                    margin: 0,
                    padding: "12px",
                    backgroundColor: "#F9FAFB",
                    borderRadius: "8px",
                    border: "1px dashed #E5E7EB",
                  }}
                >
                  저장된 희망 배송일·리본 정보가 없습니다. 이 주문이 저장 기능 도입 이전에 접수되었거나,
                  주문 시 해당 항목을 남기지 않은 경우입니다. (상세 주소·요청은 위 <strong>배송지 정보</strong>
                  란에 합쳐져 있을 수 있습니다.)
                </p>
              ) : (
                <>
                  <div style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "#374151" }}>
                    <p style={{ marginBottom: "8px" }}>
                      <span style={{ color: "#6B7280" }}>희망 배송 일시</span>
                      <br />
                      <span
                        style={{
                          fontWeight: deliveryIsToday ? 700 : 600,
                          color: deliveryIsToday ? "#B91C1C" : "#111827",
                        }}
                      >
                        {deliveryIsToday ? (
                          <span
                            style={{
                              display: "inline-block",
                              marginRight: "6px",
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              color: "#fff",
                              backgroundColor: "#DC2626",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              verticalAlign: "middle",
                            }}
                          >
                            오늘
                          </span>
                        ) : null}
                        {deliveryLine}
                      </span>
                    </p>
                    <p style={{ marginBottom: "8px" }}>
                      <span style={{ color: "#6B7280" }}>배송 방식</span>
                      <br />
                      <span style={{ fontWeight: 600 }}>{formatAdminDeliveryMethod(o.delivery_method)}</span>
                    </p>
                    {o.delivery_request_memo?.trim() ? (
                      <p style={{ marginBottom: "12px" }}>
                        <span style={{ color: "#6B7280" }}>배송 요청</span>
                        <br />
                        <span style={{ whiteSpace: "pre-wrap" }}>{o.delivery_request_memo.trim()}</span>
                      </p>
                    ) : null}
                  </div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#831843", marginBottom: "8px" }}>
                    리본 문구
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0,
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: "1px solid #F9A8D4",
                      backgroundColor: "#fff",
                    }}
                  >
                    <div style={{ padding: "12px", borderBottom: "1px solid #FCE7F3" }}>
                      <p
                        style={{ fontSize: "0.65rem", fontWeight: 700, color: "#BE185D", marginBottom: "4px" }}
                      >
                        경조사어
                      </p>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, whiteSpace: "pre-wrap", margin: 0 }}>
                        {o.ribbon_message?.trim() || "—"}
                      </p>
                    </div>
                    <div style={{ padding: "12px", backgroundColor: "#FDF2F8" }}>
                      <p
                        style={{ fontSize: "0.65rem", fontWeight: 700, color: "#BE185D", marginBottom: "4px" }}
                      >
                        보내는 분
                      </p>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, whiteSpace: "pre-wrap", margin: 0 }}>
                        {o.ribbon_sender?.trim() || "—"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* 결제 정보 */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "16px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "12px" }}>
            결제 정보
          </h2>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.875rem",
              marginBottom: "8px",
            }}
          >
            <span style={{ color: "#666" }}>결제 상태</span>
            <span>{shopPaymentStatusLabel(order.payment_status)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.875rem",
              marginBottom: "8px",
            }}
          >
            <span style={{ color: "#666" }}>결제 수단</span>
            <span>{order.payment_method}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.875rem",
              marginBottom: "8px",
            }}
          >
            <span style={{ color: "#666" }}>상품 금액</span>
            <span>{formatPrice(order.total_amount)}원</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.875rem",
              marginBottom: "12px",
            }}
          >
            <span style={{ color: "#666" }}>배송비</span>
            <span>0원</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: "12px",
              borderTop: "1px solid #E5E7EB",
            }}
          >
            <span style={{ fontSize: "1rem", fontWeight: 700 }}>총 결제금액</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#D6A8E0" }}>
              {formatPrice(order.total_amount)}원
            </span>
          </div>
          {/* Phase F1: 미결제 주문 재결제 버튼 */}
          {order.payment_status === "pending" && (
            <button
              type="button"
              onClick={handlePayNow}
              disabled={paymentSubmitting}
              style={{
                marginTop: "16px",
                width: "100%",
                padding: "14px",
                backgroundColor: "#D6A8E0",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                fontSize: "1rem",
                fontWeight: 700,
                cursor: paymentSubmitting ? "not-allowed" : "pointer",
                opacity: paymentSubmitting ? 0.7 : 1,
              }}
            >
              {/* paymentSubmitting ? "결제창으로 이동 중..." : */}결제하기
            </button>
          )}
        </div>
      </div>
    </OrderGuard>
  );
}

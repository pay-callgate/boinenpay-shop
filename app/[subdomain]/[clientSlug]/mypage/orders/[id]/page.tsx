"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";
import { formatTrackingDisplay } from "@/lib/courier";

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
  client: Client;
  user?: OrderUser | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "입금대기",
  paid: "결제완료",
  preparing: "배송준비중",
  shipping: "배송중",
  delivered: "배송완료",
  cancelled: "취소됨",
};

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

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // 주문 상세 조회 (Context 준비 후 실행)
  useEffect(() => {
    if (!orderId || !partner?.id || !client?.id) return;
    let cancelled = false;
    setLoading(true);
    shopFetch(`/api/orders/${orderId}`)
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
  }, [orderId, partner?.id, client?.id]);

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
        window.location.href = data.redirectUrl;
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

  // 상태 배지 색상
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_payment: "#F59E0B",
      paid: "#10B981",
      preparing: "#3B82F6",
      shipping: "#D6A8E0",
      delivered: "#059669",
      cancelled: "#EF4444",
    };
    return colors[status] || "#6B7280";
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
      <OrderGuard partnerId={partner.id}>
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

  return (
    <OrderGuard partnerId={partner.id}>
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
              backgroundColor: `${getStatusColor(order.status)}20`,
              color: getStatusColor(order.status),
              marginBottom: "12px",
            }}
          >
            {STATUS_LABELS[order.status] || order.status}
          </span>
          <p style={{ fontSize: "0.875rem", color: "#666" }}>
            주문번호: {order.order_no}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "4px" }}>
            {formatDate(order.created_at)}
          </p>
        </div>

        {/* 배송 추적 */}
        {order.tracking_number && (
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
          </div>
        )}

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

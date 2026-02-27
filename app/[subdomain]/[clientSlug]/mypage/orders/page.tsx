"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";

/**
 * T6-2: 마이페이지 주문 목록
 * /{subdomain}/{clientSlug}/mypage/orders
 *
 * partner/client는 ShopTemplateContext에서 전역으로 사용.
 */

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  option_json: Record<string, string> | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Client {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface Order {
  id: string;
  order_no: string;
  status: string;
  payment_status: string;
  total_amount: number;
  shipping_name: string;
  created_at: string;
  client: Client;
  order_items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "입금대기",
  paid: "결제완료",
  preparing: "배송준비중",
  shipping: "배송중",
  delivered: "배송완료",
  cancelled: "취소됨",
};

export default function MyOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const statusFilter = searchParams?.get("status");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // 주문 목록 조회 (Context의 client.id 사용)
  useEffect(() => {
    if (!client?.id) return;

    let cancelled = false;
    setLoading(true);
    (async () => {
      let url = `/api/mypage/orders?clientId=${client.id}&limit=50`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [client?.id, statusFilter]);

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
    });
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
        <p style={{ color: "#666" }}>로딩 중...</p>
      </div>
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
          paddingBottom: "80px",
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
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <button
            onClick={() => router.push(`/${subdomain}/${clientSlug}/mypage`)}
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
            주문 조회
          </h1>
        </header>

        {/* 주문 목록 */}
        {loading ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#999" }}>로딩 중...</p>
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{
              padding: "60px 16px",
              textAlign: "center",
            }}
          >
            <svg
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              style={{ margin: "0 auto 16px" }}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="#D1D5DB" strokeWidth="2" />
              <path d="M9 11l2 2 4-4" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p style={{ fontSize: "1rem", color: "#666", marginBottom: "24px" }}>
              주문 내역이 없습니다
            </p>
            <button
              onClick={() => router.push(`/${subdomain}/${clientSlug}/products`)}
              style={{
                padding: "12px 24px",
                backgroundColor: "#D6A8E0",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              쇼핑하러 가기
            </button>
          </div>
        ) : (
          <div style={{ padding: "16px" }}>
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() =>
                  router.push(`/${subdomain}/${clientSlug}/mypage/orders/${order.id}`)
                }
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "12px",
                  cursor: "pointer",
                  border: "1px solid #E5E7EB",
                }}
              >
                {/* 주문 헤더 */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                    paddingBottom: "12px",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "4px" }}>
                      {order.order_no}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#666" }}>
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      backgroundColor: `${getStatusColor(order.status)}20`,
                      color: getStatusColor(order.status),
                    }}
                  >
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>

                {/* 주문 항목 (첫 번째만 표시) */}
                {order.order_items && order.order_items.length > 0 && (
                  <div>
                    <p style={{ fontSize: "0.875rem", marginBottom: "4px" }}>
                      {order.order_items[0].product_name}
                      {order.order_items.length > 1 &&
                        ` 외 ${order.order_items.length - 1}개`}
                    </p>
                    <p style={{ fontSize: "1rem", fontWeight: 700, color: "#333" }}>
                      {formatPrice(order.total_amount)}원
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bottom Nav */}
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            maxWidth: "430px",
            margin: "0 auto",
            backgroundColor: "#fff",
            display: "flex",
            justifyContent: "space-around",
            padding: "12px 0",
            borderTop: "1px solid #E5E7EB",
          }}
        >
          {[
            { icon: "🏠", label: "홈", path: "" },
            { icon: "📂", label: "카테고리", path: "/products" },
            { icon: "🛒", label: "장바구니", path: "/cart" },
            { icon: "👤", label: "마이페이지", path: "/mypage", active: true },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() =>
                router.push(`/${subdomain}/${clientSlug}${item.path}`)
              }
              style={{
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                fontSize: "0.75rem",
                color: item.active ? "#D6A8E0" : "#666",
                fontWeight: item.active ? 600 : 400,
              }}
            >
              <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </OrderGuard>
  );
}

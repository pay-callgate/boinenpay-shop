"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { shopFetch } from "@/lib/shop-fetch";
import {
  SHOP_ORDER_FULFILLMENT_TABS,
  shopOrderCustomerBadge,
  type ShopOrderTabKey,
} from "@/lib/shop/customer-order-fulfillment";
import {
  formatDesiredDeliveryDateTimeLine,
  getAdminLocalTodayYmd,
  isDesiredDeliveryToday,
} from "@/lib/admin-florist-order-display";

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
  delivery_photo_url?: string | null;
  client?: Client | null;
  order_items: OrderItem[];
  desired_delivery_date?: string | null;
  delivery_time_slot?: string | null;
  ribbon_message?: string | null;
  ribbon_sender?: string | null;
}

export default function MyOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const statusFilter = searchParams?.get("shopStage") ?? null;

  const activeTabKey: ShopOrderTabKey =
    statusFilter && SHOP_ORDER_FULFILLMENT_TABS.some((t) => t.key === statusFilter)
      ? (statusFilter as ShopOrderTabKey)
      : "all";

  const handleTabClick = (key: ShopOrderTabKey) => {
    const base = `/${subdomain}/${clientSlug}/mypage/orders`;
    if (key === "all") {
      router.push(base);
    } else {
      router.push(`${base}?shopStage=${encodeURIComponent(key)}`);
    }
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // 주문 목록 조회 (전역 shopFetch 사용 — 401/403 시 자동 세션 만료 처리)
  useEffect(() => {
    if (!client?.id) return;

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let url = `/api/mypage/orders?clientId=${encodeURIComponent(client.id)}&limit=50`;
        if (statusFilter && statusFilter !== "all") {
          url += `&shopStage=${encodeURIComponent(statusFilter)}`;
        }
        const res = await shopFetch(url);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } catch {
        // SESSION_EXPIRED 등 — 전역에서 이미 알림·리다이렉트 처리
      } finally {
        if (!cancelled) setLoading(false);
      }
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

  return (
    <OrderGuard
      partnerId={partner.id}
      shopClientId={client?.id}
      shopClientName={client?.name ?? undefined}
    >
      <div className="flex flex-col min-h-screen bg-slate-50 max-w-[430px] mx-auto pb-[76px] relative">
        {/* 헤더 */}
        <header className="sticky top-0 z-10 shrink-0 flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
          <button
            type="button"
            onClick={() => router.push(`/${subdomain}/${clientSlug}/mypage`)}
            className="p-0 border-0 bg-transparent cursor-pointer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-800">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-lg font-bold flex-1">주문 조회</h1>
        </header>

        {/* 상태별 탭 — 가로 스크롤, 스크롤바 숨김, 스크롤 가능 힌트(그라데이션) */}
        <div className="sticky top-[57px] z-[9] w-full border-b border-gray-200 bg-white">
          <div className="relative max-w-full">
            <div
              className="pointer-events-none absolute left-0 top-0 z-[2] h-full w-7 bg-gradient-to-r from-white via-white/95 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute right-0 top-0 z-[2] h-full w-7 bg-gradient-to-l from-white via-white/95 to-transparent"
              aria-hidden
            />
            <div
              className="scrollbar-none flex max-w-full snap-x snap-mandatory gap-0 overflow-x-auto scroll-smooth overscroll-x-contain px-3 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="flex min-w-max shrink-0 items-stretch gap-0">
                {SHOP_ORDER_FULFILLMENT_TABS.map((tab) => {
                  const isActive = activeTabKey === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleTabClick(tab.key)}
                      className="snap-start shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors"
                      style={{
                        color: isActive ? "#0284C7" : "#6B7280",
                        borderBottom: isActive ? "2px solid #0284C7" : "2px solid transparent",
                        fontWeight: isActive ? 700 : 500,
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 주문 목록 */}
        <main className="flex-1 bg-white">
        {loading ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#999" }}></p>
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
              {activeTabKey !== "all"
                ? `${SHOP_ORDER_FULFILLMENT_TABS.find((t) => t.key === activeTabKey)?.label ?? ""} 단계 주문이 없습니다`
                : "결제가 완료된 주문이 없습니다"}
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
            {orders.map((order) => {
              const badge = shopOrderCustomerBadge(order);
              return (
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
                      {order.delivery_photo_url ? (
                        <span
                          style={{
                            marginLeft: "8px",
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            color: "#059669",
                            verticalAlign: "middle",
                          }}
                        >
                          배송사진
                        </span>
                      ) : null}
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
                      backgroundColor: badge.background,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
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
                    {(() => {
                      const deliveryLine = formatDesiredDeliveryDateTimeLine(
                        order.desired_delivery_date,
                        order.delivery_time_slot
                      );
                      if (deliveryLine === "—") return null;
                      const today = getAdminLocalTodayYmd();
                      const isToday = isDesiredDeliveryToday(order.desired_delivery_date, today);
                      return (
                        <p
                          style={{
                            fontSize: "0.8125rem",
                            color: isToday ? "#B91C1C" : "#4B5563",
                            fontWeight: isToday ? 700 : 500,
                            marginBottom: "6px",
                            lineHeight: 1.45,
                          }}
                        >
                          {isToday ? (
                            <span
                              style={{
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
                          희망 배송: {deliveryLine}
                        </p>
                      );
                    })()}
                    {(order.ribbon_message?.trim() || order.ribbon_sender?.trim()) && (
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "#6B7280",
                          marginBottom: "6px",
                          lineHeight: 1.4,
                        }}
                      >
                        리본:{" "}
                        {[order.ribbon_message?.trim(), order.ribbon_sender?.trim()]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p style={{ fontSize: "1rem", fontWeight: 700, color: "#333" }}>
                      {formatPrice(order.total_amount)}원
                    </p>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white flex justify-around py-3 border-t border-gray-200">
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
              className="flex flex-col items-center gap-1 cursor-pointer text-xs border-0 bg-transparent"
              style={{ color: item.active ? "#D6A8E0" : "#666", fontWeight: item.active ? 600 : 400 }}
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

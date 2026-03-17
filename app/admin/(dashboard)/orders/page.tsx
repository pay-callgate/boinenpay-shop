"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * T5-1: 주문 목록 페이지 (파트너 어드민) — 중앙 집중형 /admin/orders
 */

interface Client {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  name: string;
  email: string;
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
  user: User | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "입금대기",
  paid: "결제완료",
  preparing: "배송준비중",
  shipping: "배송중",
  delivered: "배송완료",
  cancelled: "취소됨",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  refunded: "환불됨",
};

export default function OrdersPage() {
  const router = useRouter();
  const { status } = useSession();

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    async function fetchPartnerId() {
      const res = await adminFetch("/api/partner");
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.id) setPartnerId(result.data.id);
      }
    }
    fetchPartnerId();
  }, []);

  useEffect(() => {
    async function fetchClients() {
      if (!partnerId) return;
      const res = await adminFetch(`/api/clients?partnerId=${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    }
    fetchClients();
  }, [partnerId]);

  useEffect(() => {
    async function fetchOrders() {
      if (!partnerId) return;

      setLoading(true);
      let url = `/api/orders?partnerId=${partnerId}&limit=${limit}&offset=${offset}`;
      if (selectedClient) url += `&clientId=${selectedClient}`;
      if (selectedStatus) url += `&status=${selectedStatus}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await adminFetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotal(data.total ?? 0);
      }
      setLoading(false);
    }

    fetchOrders();
  }, [partnerId, selectedClient, selectedStatus, startDate, endDate, offset]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ko-KR").format(price);
  };

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

  const handleExcelDownload = async () => {
    if (!partnerId) return;

    let url = `/api/orders/export?partnerId=${partnerId}`;
    if (selectedClient) url += `&clientId=${selectedClient}`;
    if (selectedStatus) url += `&status=${selectedStatus}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;

    try {
      const res = await adminFetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `orders_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        alert("엑셀 다운로드에 실패했습니다.");
      }
    } catch (error) {
      console.error("Excel download error:", error);
      alert("엑셀 다운로드 중 오류가 발생했습니다.");
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_payment: "#F59E0B",
      paid: "#10B981",
      preparing: "#3B82F6",
      shipping: "#8B5CF6",
      delivered: "#059669",
      cancelled: "#EF4444",
    };
    return colors[status] || "#6B7280";
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = total === 0 ? 1 : Math.min(totalPages, Math.floor(offset / limit) + 1);

  if (status === "loading" || !partnerId) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50 p-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-600"></p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50 p-6">
      {/* [2] 상단 고정: 타이틀·필터 (스크롤 시 찌그러짐 방지) */}
      <div className="shrink-0">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">주문 관리</h1>
            <p className="mt-1 text-sm text-slate-600">전체 주문 내역을 조회하고 관리합니다.</p>
          </div>
          <button
            type="button"
            onClick={handleExcelDownload}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            엑셀 다운로드
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">거래처</label>
              <select
                value={selectedClient}
                onChange={(e) => {
                  setSelectedClient(e.target.value);
                  setOffset(0);
                }}
                className="h-10 min-w-[140px] rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                <option value="">전체</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">주문 상태</label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setOffset(0);
                }}
                className="h-10 min-w-[120px] rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                <option value="">전체</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setOffset(0);
                }}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setOffset(0);
                }}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
          </div>
        </div>

        <p className="mb-3 text-sm text-slate-600">총 {total}건</p>
      </div>

      {/* [3] 테이블 카드 + 내부 스크롤 / [4] 하단 고정 페이징 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_#e2e8f0]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">주문일시</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">주문번호</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">거래처</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">주문자</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">받는 분</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">금액</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">상태</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">결제</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                    주문 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                    className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/orders/${order.id}`);
                        }}
                        className="text-left font-medium text-blue-600 underline hover:no-underline"
                      >
                        {order.order_no}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {order.client?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {order.user?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {order.shipping_name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">
                      {formatPrice(Number(order.total_amount) || 0)}원
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: `${getStatusColor(order.status)}20`,
                          color: getStatusColor(order.status),
                        }}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status ?? "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* [4] 하단 고정 페이징 (상품 관리와 동일) */}
        {!loading && total > 0 && (
          <div className="flex shrink-0 flex-col items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
              <div
                className="absolute top-0 h-full rounded-full bg-slate-600 transition-all duration-200"
                style={{
                  width: `${totalPages > 0 ? 100 / totalPages : 0}%`,
                  left: `${totalPages > 0 ? ((currentPage - 1) / totalPages) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setOffset(0)}
                disabled={currentPage <= 1}
                className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                aria-label="맨 처음"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOffset((p) => Math.max(0, p - limit))}
                disabled={currentPage <= 1}
                className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                aria-label="이전"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="min-w-[4rem] text-center text-sm font-medium text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setOffset((p) => p + limit)}
                disabled={currentPage >= totalPages}
                className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                aria-label="다음"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOffset((totalPages - 1) * limit)}
                disabled={currentPage >= totalPages}
                className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                aria-label="맨 끝"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

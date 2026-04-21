"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * 취소/반품 페이지 (파트너 어드민)
 * /admin/orders/returns (중앙 집중형)
 * - 취소된 주문 목록 조회 및 상세 이동
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
  received: "접수",
  cancelled: "취소됨",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  refunded: "환불됨",
};

export default function OrdersReturnsPage() {
  const router = useRouter();

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedClient, setSelectedClient] = useState<string>("");
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
      let url = `/api/orders?partnerId=${partnerId}&status=cancelled&limit=${limit}&offset=${offset}`;
      if (selectedClient) url += `&clientId=${selectedClient}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await adminFetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotal(data.total || 0);
      }
      setLoading(false);
    }
    fetchOrders();
  }, [partnerId, selectedClient, startDate, endDate, offset]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ko-KR").format(price);

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

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = total === 0 ? 1 : Math.min(totalPages, Math.floor(offset / limit) + 1);

  if (!partnerId) {
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
      {/* [2] 상단 고정: 타이틀·필터 */}
      <div className="shrink-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">취소/반품</h1>
          <p className="mt-1 text-sm text-slate-600">
            취소된 주문 목록을 조회합니다. 반품 요청 처리 기능은 추후 제공 예정입니다.
          </p>
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
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">수령인</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">금액</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">결제상태</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">액션</th>
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
                    취소된 주문이 없습니다.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/orders/${order.id}`)}
                        className="text-left font-medium text-blue-600 underline hover:no-underline"
                      >
                        {order.order_no}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{order.client?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{order.user?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{order.shipping_name ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">
                      {formatPrice(Number(order.total_amount))}원
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/orders/${order.id}`)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        상세
                      </button>
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

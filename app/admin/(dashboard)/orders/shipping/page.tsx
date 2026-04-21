"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin-fetch";
import { COURIER_OPTIONS, formatTrackingDisplay } from "@/lib/courier";

/**
 * 배송 관리 페이지 (파트너 어드민)
 * /admin/orders/shipping (중앙 집중형)
 * - 배송 대기/진행 중인 주문 목록
 * - 송장 번호 등록 및 배송 상태 변경
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
  shipping_phone: string;
  shipping_address: string;
  shipping_detail: string | null;
  shipping_postcode: string | null;
  tracking_number: string | null;
  courier_company: string | null;
  created_at: string;
  client: Client;
  user: User | null;
}

const STATUS_LABELS: Record<string, string> = {
  received: "접수",
  pending_payment: "입금대기",
  paid: "결제완료",
  preparing: "배송준비중",
  shipping: "배송중",
  delivered: "배송완료",
  cancelled: "취소됨",
};

const SHIPPING_STATUS_OPTIONS = [
  { value: "preparing", label: "배송준비중" },
  { value: "shipping", label: "배송중" },
  { value: "delivered", label: "배송완료" },
];

export default function OrdersShippingPage() {
  const router = useRouter();

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

  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editCourierCompany, setEditCourierCompany] = useState("");
  const [editTracking, setEditTracking] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [updating, setUpdating] = useState(false);

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
        setTotal(data.total || 0);
      }
      setLoading(false);
    }
    fetchOrders();
  }, [partnerId, selectedClient, selectedStatus, startDate, endDate, offset]);

  const openEdit = (order: Order) => {
    setEditOrder(order);
    setEditCourierCompany(order.courier_company || "");
    setEditTracking(order.tracking_number || "");
    setEditStatus(order.status);
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder) return;
    setUpdating(true);
    try {
      const res = await adminFetch(`/api/partner/orders/${editOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          trackingNumber: editTracking || null,
          courierCompany: editCourierCompany || null,
          memo: null,
        }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === editOrder.id
              ? {
                  ...o,
                  status: editStatus,
                  tracking_number: editTracking || null,
                  courier_company: editCourierCompany || null,
                }
              : o
          )
        );
        setEditOrder(null);
      } else {
        const err = await res.json();
        alert(err.error || "저장에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setUpdating(false);
    }
  };

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      received: "#64748B",
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
    <>
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50 p-6">
      {/* [2] 상단 고정: 타이틀·필터 */}
      <div className="shrink-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">배송 관리</h1>
          <p className="mt-1 text-sm text-slate-600">
            주문별 배송 상태를 관리하고 송장을 등록하는 기능입니다.
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
              <label className="mb-1 block text-sm font-medium text-slate-700">배송 상태</label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setOffset(0);
                }}
                className="h-10 min-w-[120px] rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                <option value="">전체</option>
                <option value="preparing">배송준비중</option>
                <option value="shipping">배송중</option>
                <option value="delivered">배송완료</option>
                <option value="paid">결제완료</option>
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
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600 min-w-[140px]">
                  주문일시
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  주문번호
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  거래처
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600 min-w-[80px]">
                  수령인
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  연락처
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  배송지
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold text-slate-600">
                  상태
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  송장번호
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold text-slate-600 min-w-[100px]">
                  액션
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    조건에 맞는 주문이 없습니다.
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
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/orders/${order.id}`)}
                        className="text-left font-medium text-blue-600 underline hover:no-underline"
                      >
                        {order.order_no}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {order.client.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {order.shipping_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {order.shipping_phone}
                    </td>
                    <td
                      className="max-w-xs truncate px-4 py-3 text-sm text-slate-600 lg:max-w-md"
                      title={`${order.shipping_address} ${order.shipping_detail || ""}`}
                    >
                      {order.shipping_postcode && `[${order.shipping_postcode}] `}
                      {order.shipping_address}
                      {order.shipping_detail && ` ${order.shipping_detail}`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
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
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-slate-600">
                      {formatTrackingDisplay(order.courier_company, order.tracking_number)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => openEdit(order)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        송장/상태
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

      {/* 송장/상태 수정 모달 */}
      {editOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => !updating && setEditOrder(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shipping-modal-title"
          >
            <h2 id="shipping-modal-title" className="text-lg font-bold text-slate-800">
              송장·배송 상태 수정 — {editOrder.order_no}
            </h2>
            <form onSubmit={handleSaveShipping} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  택배사 선택
                </label>
                <select
                  value={editCourierCompany}
                  onChange={(e) => setEditCourierCompany(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {COURIER_OPTIONS.map((opt) => (
                    <option key={opt.value || "none"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  송장 번호
                </label>
                <input
                  type="text"
                  value={editTracking}
                  onChange={(e) => setEditTracking(e.target.value)}
                  placeholder="택배사 송장번호 입력"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  배송 상태
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {SHIPPING_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOrder(null)}
                  disabled={updating}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {"저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

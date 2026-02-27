"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * 배송 관리 페이지 (파트너 어드민)
 * /[subdomain]/admin/orders/shipping
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

const SHIPPING_STATUS_OPTIONS = [
  { value: "preparing", label: "배송준비중" },
  { value: "shipping", label: "배송중" },
  { value: "delivered", label: "배송완료" },
];

export default function OrdersShippingPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = params?.subdomain as string;

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
  const [editTracking, setEditTracking] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function fetchPartnerId() {
      if (!subdomain) return;
      const res = await fetch(`/api/partner?subdomain=${subdomain}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.id) setPartnerId(result.data.id);
      }
    }
    fetchPartnerId();
  }, [subdomain]);

  useEffect(() => {
    async function fetchClients() {
      if (!partnerId) return;
      const res = await fetch(`/api/clients?partnerId=${partnerId}`);
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

      const res = await fetch(url);
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
    setEditTracking(order.tracking_number || "");
    setEditStatus(order.status);
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/partner/orders/${editOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          trackingNumber: editTracking || null,
          memo: null,
        }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === editOrder.id
              ? { ...o, status: editStatus, tracking_number: editTracking || null }
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
      pending_payment: "#F59E0B",
      paid: "#10B981",
      preparing: "#3B82F6",
      shipping: "#8B5CF6",
      delivered: "#059669",
      cancelled: "#EF4444",
    };
    return colors[status] || "#6B7280";
  };

  if (!partnerId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-800">배송 관리</h1>
        <p className="mt-2 text-slate-600">
          주문별 배송 상태를 관리하고 송장을 등록하는 기능입니다.
        </p>
      </div>

      {/* 필터 */}
      <div className="grid grid-cols-2 gap-4 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">거래처</label>
          <select
            value={selectedClient}
            onChange={(e) => {
              setSelectedClient(e.target.value);
              setOffset(0);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
        {loading ? (
          <div className="py-12 text-center text-slate-500">로딩 중...</div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            조건에 맞는 주문이 없습니다.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">주문일시</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">주문번호</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">거래처</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">수령인</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">연락처</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">배송지</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">상태</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">송장번호</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">액션</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <button
                      type="button"
                      onClick={() => router.push(`/${subdomain}/admin/orders/${order.id}`)}
                      className="text-left text-blue-600 underline hover:no-underline"
                    >
                      {order.order_no}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{order.client.name}</td>
                  <td className="px-4 py-3 text-slate-700">{order.shipping_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {order.shipping_phone}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-600" title={`${order.shipping_address} ${order.shipping_detail || ""}`}>
                    {order.shipping_postcode && `[${order.shipping_postcode}] `}
                    {order.shipping_address}
                    {order.shipping_detail && ` ${order.shipping_detail}`}
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
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {order.tracking_number || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(order)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      송장/상태
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {orders.length > 0 && (() => {
          const totalPages = Math.max(1, Math.ceil(total / limit));
          const currentPage = Math.min(totalPages, Math.floor(offset / limit) + 1);
          return (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-4 flex flex-col items-center justify-center gap-3">
              <div className="h-1 w-full max-w-sm overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-slate-600 transition-all duration-300 rounded-full"
                  style={{ width: `${(currentPage / totalPages) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setOffset((p) => Math.max(0, p - limit))}
                  disabled={offset === 0}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  이전
                </button>
                <span className="min-w-[3rem] text-center text-sm font-medium text-slate-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setOffset((p) => p + limit)}
                  disabled={offset + limit >= total}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          );
        })()}
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
                  {updating ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

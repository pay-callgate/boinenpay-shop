"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * 취소/반품 페이지 (파트너 어드민)
 * /[subdomain]/admin/orders/returns
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
  cancelled: "취소됨",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  refunded: "환불됨",
};

export default function OrdersReturnsPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = params?.subdomain as string;

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
      let url = `/api/orders?partnerId=${partnerId}&status=cancelled&limit=${limit}&offset=${offset}`;
      if (selectedClient) url += `&clientId=${selectedClient}`;
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
        <h1 className="text-xl font-bold text-slate-800">취소/반품</h1>
        <p className="mt-2 text-slate-600">
          취소된 주문 목록을 조회합니다. 반품 요청 처리 기능은 추후 제공 예정입니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
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

      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-slate-500">로딩 중...</div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            취소된 주문이 없습니다.
          </div>
        ) : (
          <>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">주문일시</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">주문번호</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">거래처</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">주문자</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">수령인</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">금액</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">결제상태</th>
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
                    <td className="px-4 py-3 text-slate-600">{order.user?.name || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{order.shipping_name}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatPrice(order.total_amount)}원
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/${subdomain}/admin/orders/${order.id}`)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-600">
                총 {total}건 중 {offset + 1}–{Math.min(offset + limit, total)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOffset((p) => Math.max(0, p - limit))}
                  disabled={offset === 0}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  이전
                </button>
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
          </>
        )}
      </div>
    </div>
  );
}

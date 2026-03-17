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

  if (status === "loading" || !partnerId) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p style={{ color: "#666" }}></p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "8px" }}>
            주문 관리
          </h1>
          <p style={{ color: "#666", fontSize: "0.875rem" }}>
            전체 주문 내역을 조회하고 관리합니다.
          </p>
        </div>
        <button
          onClick={handleExcelDownload}
          style={{
            padding: "10px 20px",
            backgroundColor: "#1e293b",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
          padding: "20px",
          backgroundColor: "#F9FAFB",
          borderRadius: "8px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.875rem",
              marginBottom: "6px",
              fontWeight: 600,
            }}
          >
            거래처
          </label>
          <select
            value={selectedClient}
            onChange={(e) => {
              setSelectedClient(e.target.value);
              setOffset(0);
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              fontSize: "0.875rem",
            }}
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
          <label
            style={{
              display: "block",
              fontSize: "0.875rem",
              marginBottom: "6px",
              fontWeight: 600,
            }}
          >
            주문 상태
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setOffset(0);
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              fontSize: "0.875rem",
            }}
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
          <label
            style={{
              display: "block",
              fontSize: "0.875rem",
              marginBottom: "6px",
              fontWeight: 600,
            }}
          >
            시작일
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setOffset(0);
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              fontSize: "0.875rem",
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.875rem",
              marginBottom: "6px",
              fontWeight: 600,
            }}
          >
            종료일
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setOffset(0);
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              fontSize: "0.875rem",
            }}
          />
        </div>
      </div>

      <div
        className="[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400"
        style={{
          backgroundColor: "#fff",
          borderRadius: "8px",
          border: "1px solid #E5E7EB",
          overflow: "auto",
        }}
      >
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#666" }}></p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ color: "#999" }}>주문 내역이 없습니다.</p>
          </div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.875rem", fontWeight: 600 }}>
                    주문일시
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.875rem", fontWeight: 600 }}>
                    주문번호
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.875rem", fontWeight: 600 }}>
                    거래처
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.875rem", fontWeight: 600 }}>
                    주문자
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.875rem", fontWeight: 600 }}>
                    받는 분
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.875rem", fontWeight: 600 }}>
                    금액
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "0.875rem", fontWeight: 600 }}>
                    상태
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "0.875rem", fontWeight: 600 }}>
                    결제
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                    style={{
                      borderBottom: "1px solid #E5E7EB",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#fff";
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontSize: "0.875rem", color: "#666" }}>
                      {formatDate(order.created_at)}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "0.875rem", fontWeight: 600 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/orders/${order.id}`);
                        }}
                        style={{
                          color: "#2563eb",
                          textDecoration: "underline",
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          font: "inherit",
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                        onMouseOut={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                      >
                        {order.order_no}
                      </button>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "0.875rem" }}>
                      {order.client?.name ?? "-"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "0.875rem" }}>
                      {order.user?.name ?? "-"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "0.875rem" }}>
                      {order.shipping_name ?? "-"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "0.875rem", textAlign: "right", fontWeight: 600 }}>
                      {formatPrice(Number(order.total_amount) || 0)}원
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
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
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontSize: "0.875rem" }}>
                      {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(() => {
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
                      onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
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
                      onClick={() => setOffset((prev) => prev + limit)}
                      disabled={offset + limit >= total}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      다음
                    </button>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

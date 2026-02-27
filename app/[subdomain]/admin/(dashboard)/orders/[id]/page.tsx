"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * T5-2 & T5-3: 주문 상세 및 상태 변경 페이지 (파트너 어드민)
 * /[subdomain]/admin/orders/[id]
 *
 * 기능:
 * - 주문 정보 표시
 * - 주문 항목 목록
 * - 상태 이력
 * - 상태 변경 및 송장 입력
 */

interface Client {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  option_json: Record<string, string> | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  product: Product;
}

interface StatusHistory {
  id: string;
  status: string;
  memo: string | null;
  created_at: string;
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

const STATUS_OPTIONS = [
  { value: "paid", label: "결제완료" },
  { value: "preparing", label: "배송준비중" },
  { value: "shipping", label: "배송중" },
  { value: "delivered", label: "배송완료" },
  { value: "cancelled", label: "취소됨" },
];

function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    pending_payment: "bg-amber-100 text-amber-800",
    paid: "bg-emerald-100 text-emerald-800",
    preparing: "bg-blue-100 text-blue-800",
    shipping: "bg-violet-100 text-violet-800",
    delivered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return map[status] || "bg-slate-100 text-slate-800";
}

function getStatusBorderClass(status: string): string {
  const map: Record<string, string> = {
    pending_payment: "border-l-amber-500",
    paid: "border-l-emerald-500",
    preparing: "border-l-blue-500",
    shipping: "border-l-violet-500",
    delivered: "border-l-emerald-500",
    cancelled: "border-l-red-500",
  };
  return map[status] || "border-l-slate-400";
}

function getStatusTextClass(status: string): string {
  const map: Record<string, string> = {
    pending_payment: "text-amber-800",
    paid: "text-emerald-800",
    preparing: "text-blue-800",
    shipping: "text-violet-800",
    delivered: "text-emerald-800",
    cancelled: "text-red-800",
  };
  return map[status] || "text-slate-800";
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const subdomain = params?.subdomain as string;
  const orderId = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const [newStatus, setNewStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [memo, setMemo] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return;

      setLoading(true);
      const res = await fetch(`/api/partner/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setItems(data.items || []);
        setHistory(data.history || []);
        setNewStatus(data.order.status);
        setTrackingNumber(data.order.tracking_number || "");
      }
      setLoading(false);
    }

    fetchOrder();
  }, [orderId]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!order || !newStatus) return;

    setUpdating(true);

    try {
      const res = await fetch(`/api/partner/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          trackingNumber: trackingNumber || null,
          memo: memo || null,
        }),
      });

      if (res.ok) {
        alert("주문 상태가 업데이트되었습니다.");
        window.location.reload();
      } else {
        const error = await res.json();
        alert(error.error || "상태 업데이트에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setUpdating(false);
    }
  };

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

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-slate-50 p-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-slate-50 p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <h1 className="text-xl font-bold text-slate-800 mb-2">주문을 찾을 수 없습니다</h1>
          <button
            type="button"
            onClick={() => router.push(`/${subdomain}/admin/orders`)}
            className="mt-4 h-10 px-6 rounded-lg font-medium text-white bg-slate-800 hover:bg-slate-900"
          >
            주문 목록으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-50 p-6">
      {/* 헤더: 표준 타이틀 + 서브타이틀 구조 */}
      <div className="shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">주문 정보(상세)</h1>
        <p className="mt-1 text-sm text-slate-500">
          해당 주문의 상세 내역을 확인하고 상태를 관리합니다.
        </p>
      </div>

      {/* 본문: 왼쪽 2비율, 오른쪽 1비율 */}
      <div className="flex-1 overflow-y-auto min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 주문 정보 (2열) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* 주문 기본 정보 */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">주문 정보</h2>
            <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
              <span className="text-slate-600">주문번호</span>
              <span className="font-semibold text-slate-900">{order.order_no}</span>

              <span className="text-slate-600">주문일시</span>
              <span className="text-slate-900">{formatDate(order.created_at)}</span>

              <span className="text-slate-600">거래처</span>
              <span className="text-slate-900">{order.client.name}</span>

              <span className="text-slate-600">주문자</span>
              <span className="text-slate-900">
                {order.user?.name || "-"} ({order.user?.email || "-"})
              </span>

              <span className="text-slate-600">결제 수단</span>
              <span className="text-slate-900">{order.payment_method}</span>

              <span className="text-slate-600">주문 상태</span>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(order.status)}`}
              >
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
          </div>

          {/* 배송지 정보 */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">배송지 정보</h2>
            <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
              <span className="text-slate-600">받는 분</span>
              <span className="text-slate-900">{order.shipping_name}</span>

              <span className="text-slate-600">연락처</span>
              <span className="text-slate-900">{order.shipping_phone}</span>

              <span className="text-slate-600">주소</span>
              <span className="text-slate-900">
                {order.shipping_postcode && `[${order.shipping_postcode}] `}
                {order.shipping_address}
                {order.shipping_detail && `, ${order.shipping_detail}`}
              </span>

              <span className="text-slate-600">송장번호</span>
              <span className="font-semibold text-slate-900">{order.tracking_number || "-"}</span>
            </div>
          </div>

          {/* 주문 항목 */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">주문 항목</h2>
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 bg-slate-50 rounded-lg"
                >
                  <div className="w-20 h-20 shrink-0 bg-slate-200 rounded-lg overflow-hidden">
                    {item.product.thumbnail_url && (
                      <img
                        src={item.product.thumbnail_url}
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-slate-900 mb-1">{item.product_name}</p>
                    {item.option_json && (
                      <p className="text-[13px] text-slate-600 mb-1">
                        {Object.entries(item.option_json)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(", ")}
                      </p>
                    )}
                    <p className="text-sm text-slate-600">
                      {formatPrice(item.unit_price)}원 × {item.quantity}개
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-slate-900">{formatPrice(item.total_price)}원</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-lg font-bold text-slate-900">총 결제금액</span>
              <span className="text-xl font-bold text-slate-900">{formatPrice(order.total_amount)}원</span>
            </div>
          </div>
        </div>

        {/* 오른쪽: 상태 변경 및 이력 (1열) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* 상태 변경 폼 */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">상태 변경</h2>
            <form onSubmit={handleStatusUpdate} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">주문 상태</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:ring-1 focus:ring-slate-600 focus:border-slate-600"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">송장번호</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="송장번호 입력"
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:ring-1 focus:ring-slate-600 focus:border-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">메모</label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="상태 변경 메모 (선택)"
                  rows={3}
                  className="w-full min-h-[80px] px-3 py-2 rounded-md border border-slate-300 text-sm focus:ring-1 focus:ring-slate-600 focus:border-slate-600 resize-y"
                />
              </div>

              <button
                type="submit"
                disabled={updating}
                className="w-full h-10 rounded-lg font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {updating ? "업데이트 중..." : "상태 업데이트"}
              </button>
            </form>
          </div>

          {/* 상태 이력 */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">상태 이력</h2>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-5">이력이 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className={`p-3 bg-slate-50 rounded-md border-l-4 ${getStatusBorderClass(h.status)}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-sm font-semibold ${getStatusTextClass(h.status)}`}>
                        {STATUS_LABELS[h.status] || h.status}
                      </span>
                      <span className="text-xs text-slate-600">{formatDate(h.created_at)}</span>
                    </div>
                    {h.memo && <p className="text-[13px] text-slate-600">{h.memo}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

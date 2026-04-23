"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { adminFetch } from "@/lib/admin-fetch";
import { COURIER_OPTIONS, formatTrackingDisplay } from "@/lib/courier";
import {
  mergeFloristDraftForOrder,
  mergeProductDraftForOrder,
} from "@/lib/newrun/merge-order-drafts";
import { isKakaoTalkInAppBrowser } from "@/lib/kakao-in-app-browser";
import { formatAdminNewrunSubmitLabel } from "@/lib/newrun/admin-order-newrun-summary";
import {
  ADMIN_NEWRUN_DELIVERY_STATE_HINT_LONG,
  hasNewrunDeliveryCallbackInfo,
  isNewrunCourierReadOnly,
} from "@/lib/newrun/admin-newrun-courier-lock";
import { formatAdminOrdererDetailLine } from "@/lib/admin-orderer-display";
import {
  formatAdminDeliveryMethod,
  formatDesiredDeliveryDateTimeLine,
  getAdminLocalTodayYmd,
  isDesiredDeliveryToday,
} from "@/lib/admin-florist-order-display";

/**
 * T5-2 & T5-3: 주문 상세 및 상태 변경 페이지 (파트너 어드민)
 * /admin/orders/[id] (중앙 집중형)
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
  newrun_default_florist_draft?: Record<string, unknown> | null;
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
  newrun_default_product_draft?: Record<string, unknown> | null;
  newrun_default_option_draft?: Record<string, unknown> | null;
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
  courier_company: string | null;
  created_at: string;
  /** 뉴런(Newrun) 협회 검색 선택값 — JSONB (T3.3) */
  newrun_florist_draft?: Record<string, unknown> | null;
  newrun_product_draft?: Record<string, unknown> | null;
  newrun_option_draft?: Record<string, unknown> | null;
  newrun_submit_status?: string | null;
  newrun_rwr_result?: string | null;
  newrun_rwr_orderkey?: string | null;
  newrun_last_submit_error?: string | null;
  newrun_last_submit_at?: string | null;
  /** Phase 7 뉴런 배송 콜백(2.6) 누적 */
  newrun_delivery_info?: Record<string, unknown> | null;
  client: Client;
  user: User | null;
  is_guest?: boolean | null;
  orderer_name?: string | null;
  guest_orderer_email?: string | null;
  desired_delivery_date?: string | null;
  delivery_time_slot?: string | null;
  delivery_method?: string | null;
  delivery_request_memo?: string | null;
  ribbon_sender?: string | null;
  ribbon_message?: string | null;
}

function coerceStringMapFromJson(v: unknown): Record<string, string> | null {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
    else if (typeof val === "number" || typeof val === "boolean") out[k] = String(val);
    else if (val != null) out[k] = JSON.stringify(val);
    else out[k] = "";
  }
  return out;
}

const STATUS_LABELS: Record<string, string> = {
  received: "접수",
  confirmed: "주문확정",
  pending_payment: "입금대기",
  paid: "결제완료",
  preparing: "배송준비중",
  shipping: "배송중",
  delivered: "배송완료",
  cancelled: "취소됨",
};

const STATUS_OPTIONS = [
  { value: "received", label: "접수" },
  { value: "confirmed", label: "주문확정" },
  { value: "paid", label: "결제완료" },
  { value: "preparing", label: "배송준비중" },
  { value: "shipping", label: "배송중" },
  { value: "delivered", label: "배송완료" },
  { value: "cancelled", label: "취소됨" },
];

function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    received: "bg-slate-100 text-slate-800",
    confirmed: "bg-sky-100 text-sky-900",
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
    received: "border-l-slate-500",
    confirmed: "border-l-sky-500",
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
    received: "text-slate-800",
    confirmed: "text-sky-900",
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

  const orderId = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const [newStatus, setNewStatus] = useState("");
  const [courierCompany, setCourierCompany] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [memo, setMemo] = useState("");
  const [updating, setUpdating] = useState(false);

  /** 뉴런(Newrun) 협회 검색 팝업 — var_ret postMessage 결과 + DB 초안(T3.3) */
  const [newrunFloristPayload, setNewrunFloristPayload] = useState<Record<
    string,
    string
  > | null>(null);
  const [newrunProductPayload, setNewrunProductPayload] = useState<Record<
    string,
    string
  > | null>(null);
  const [newrunOptionPayload, setNewrunOptionPayload] = useState<Record<
    string,
    string
  > | null>(null);
  const [newrunOpening, setNewrunOpening] = useState<string | null>(null);
  const [newrunPreviewJson, setNewrunPreviewJson] = useState<string | null>(null);
  const [newrunPreviewLoading, setNewrunPreviewLoading] = useState(false);
  const [newrunSubmitLoading, setNewrunSubmitLoading] = useState(false);

  /** T3.4: 거래처·상품 기본 draft + 주문 저장 draft 병합(발주 매핑 Phase 4 입력) */
  const effectiveNewrunFlorist = useMemo(() => {
    if (!order) return null;
    return mergeFloristDraftForOrder(
      order.client?.newrun_default_florist_draft,
      newrunFloristPayload ?? coerceStringMapFromJson(order.newrun_florist_draft) ?? undefined
    );
  }, [order, newrunFloristPayload]);

  const effectiveNewrunProduct = useMemo(() => {
    if (!order) return null;
    const p = items[0]?.product;
    return mergeProductDraftForOrder(
      p?.newrun_default_product_draft,
      newrunProductPayload ?? coerceStringMapFromJson(order.newrun_product_draft) ?? undefined
    );
  }, [order, items, newrunProductPayload]);

  const effectiveNewrunOption = useMemo(() => {
    if (!order) return null;
    const p = items[0]?.product;
    return mergeProductDraftForOrder(
      p?.newrun_default_option_draft,
      newrunOptionPayload ?? coerceStringMapFromJson(order.newrun_option_draft) ?? undefined
    );
  }, [order, items, newrunOptionPayload]);

  const newrunDispatchSummary = useMemo(() => {
    const f = effectiveNewrunFlorist;
    const p = effectiveNewrunProduct;
    const sujuid =
      f?.rw_sujuid?.trim() ||
      f?.var_sid?.trim() ||
      f?.sujuid?.trim() ||
      "";
    const menucode =
      p?.rw_menucode?.trim() ||
      p?.var_menucode?.trim() ||
      p?.goodcode?.trim() ||
      p?.var_goodcode?.trim() ||
      "";
    return { sujuid: sujuid || "—", menucode: menucode || "—" };
  }, [effectiveNewrunFlorist, effectiveNewrunProduct]);

  const persistNewrunDraft = React.useCallback(
    async (kind: "florist" | "product" | "option", payload: Record<string, string>) => {
      if (!orderId) return;
      const res = await adminFetch(`/api/partner/orders/${orderId}/newrun-draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, payload }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error || "뉴런 선택값 저장에 실패했습니다. 다시 시도해 주세요.");
      }
    },
    [orderId]
  );

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as { type?: string; kind?: string; payload?: Record<string, string> };
      if (!data || data.type !== "NEWRUN_VAR_RET") return;
      if (data.kind === "florist" && data.payload) {
        setNewrunFloristPayload(data.payload);
        void persistNewrunDraft("florist", data.payload);
      }
      if (data.kind === "product" && data.payload) {
        setNewrunProductPayload(data.payload);
        void persistNewrunDraft("product", data.payload);
      }
      if (data.kind === "option" && data.payload) {
        setNewrunOptionPayload(data.payload);
        void persistNewrunDraft("option", data.payload);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [persistNewrunDraft]);

  const openNewrunSearch = async (kind: "florist" | "product" | "option") => {
    if (!orderId) return;
    if (typeof navigator !== "undefined" && isKakaoTalkInAppBrowser(navigator.userAgent)) {
      alert(
        "카카오톡 인앱 브라우저에서는 협회 사이트·팝업이 제한될 수 있습니다. Safari·Chrome 등 시스템 브라우저에서 이 어드민 페이지를 연 뒤 다시 시도해 주세요."
      );
    }
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
      const ok = window.confirm(
        "모바일에서는 팝업이 차단되기 쉽습니다. 가능하면 PC 브라우저에서 진행하는 것을 권장합니다. 계속하시겠습니까?"
      );
      if (!ok) return;
    }
    setNewrunOpening(kind);
    try {
      const res = await adminFetch(
        `/api/partner/integrations/newrun/search-url?kind=${encodeURIComponent(kind)}&orderId=${encodeURIComponent(orderId)}`
      );
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        alert(data.error || "검색 URL을 가져오지 못했습니다.");
        return;
      }
      if (!data.url) {
        alert("검색 URL이 비어 있습니다.");
        return;
      }
      const popup = window.open(data.url, "_blank", "noopener,noreferrer,width=1100,height=800");
      if (popup == null) {
        alert(
          "팝업이 차단된 것 같습니다. 브라우저 주소창 오른쪽의 팝업 허용 아이콘을 눌러 이 사이트의 팝업을 허용한 뒤, 버튼을 다시 눌러 주세요."
        );
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setNewrunOpening(null);
    }
  };

  const loadNewrunPayloadPreview = async () => {
    if (!orderId) return;
    setNewrunPreviewLoading(true);
    setNewrunPreviewJson(null);
    try {
      const res = await adminFetch(`/api/partner/orders/${orderId}/newrun-preview`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string }).error || "미리보기를 불러오지 못했습니다.");
        return;
      }
      setNewrunPreviewJson(JSON.stringify(data, null, 2));
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setNewrunPreviewLoading(false);
    }
  };

  const submitNewrunManual = async (forceRetry: boolean) => {
    if (!orderId || !order) return;
    if (order.payment_status !== "paid") {
      alert("결제완료된 주문만 뉴런 발주할 수 있습니다.");
      return;
    }
    if (
      forceRetry &&
      !window.confirm(
        "강제 재시도 시 동일 주문번호(rw_sno)로 다시 전송됩니다. 뉴런 정책에 따라 결과코드 20(중복) 등이 나올 수 있습니다. 계속할까요?"
      )
    ) {
      return;
    }
    setNewrunSubmitLoading(true);
    try {
      const res = await adminFetch(`/api/partner/orders/${orderId}/newrun-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRetry }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        skipped?: boolean;
        duplicate?: boolean;
      };
      if (!res.ok) {
        alert(data.error || "발주 요청에 실패했습니다.");
        return;
      }
      alert(data.message || (data.ok ? "처리되었습니다." : "발주에 실패했습니다."));
      window.location.reload();
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setNewrunSubmitLoading(false);
    }
  };

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return;

      setLoading(true);
      const res = await adminFetch(`/api/partner/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setItems(data.items || []);
        setHistory(data.history || []);
        setNewStatus(data.order.status);
        setCourierCompany(data.order.courier_company || "");
        setTrackingNumber(data.order.tracking_number || "");
        setNewrunFloristPayload(coerceStringMapFromJson(data.order.newrun_florist_draft));
        setNewrunProductPayload(coerceStringMapFromJson(data.order.newrun_product_draft));
        setNewrunOptionPayload(coerceStringMapFromJson(data.order.newrun_option_draft));
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
      const res = await adminFetch(`/api/partner/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          trackingNumber: trackingNumber || null,
          courierCompany: courierCompany || null,
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
          <p className="text-slate-600"></p>
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
            onClick={() => router.push("/admin/orders")}
            className="mt-4 h-10 px-6 rounded-lg font-medium text-white bg-slate-800 hover:bg-slate-900"
          >
            주문 목록으로
          </button>
        </div>
      </div>
    );
  }

  const newrunCourierLocked = isNewrunCourierReadOnly(order);
  const floristDetailTodayYmd = getAdminLocalTodayYmd();
  const floristDesiredDeliveryIsToday = isDesiredDeliveryToday(
    order.desired_delivery_date,
    floristDetailTodayYmd
  );

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
              <span className="text-slate-900">{order.client?.name ?? "-"}</span>

              <span className="text-slate-600">주문자</span>
              <span className="text-slate-900">{formatAdminOrdererDetailLine(order)}</span>

              <span className="text-slate-600">결제 수단</span>
              <span className="text-slate-900">{order.payment_method ?? "-"}</span>

              <span className="text-slate-600">주문 상태</span>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(order.status)}`}
              >
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
          </div>

          {/* 화훼: 희망 배송일·리본 */}
          <div className="rounded-lg border border-rose-200/90 bg-gradient-to-br from-rose-50/95 via-white to-amber-50/50 shadow-sm p-6">
            <h2 className="text-lg font-bold text-rose-950">화훼 배송 및 리본 정보</h2>
            <p className="mt-1 text-xs text-rose-800/75">
              직배·화환 주문의 희망 배달 일시와 리본 인쇄 문구를 확인합니다.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="block text-xs font-medium text-slate-500">희망 배송 일시</span>
                <span
                  className={`mt-0.5 inline-flex flex-wrap items-center gap-2 ${
                    floristDesiredDeliveryIsToday ? "font-bold text-red-600" : "text-slate-900"
                  }`}
                >
                  {floristDesiredDeliveryIsToday ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                      오늘 배송
                    </span>
                  ) : null}
                  {formatDesiredDeliveryDateTimeLine(
                    order.desired_delivery_date,
                    order.delivery_time_slot
                  )}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500">배송 방식</span>
                <span className="mt-0.5 text-slate-900">
                  {formatAdminDeliveryMethod(order.delivery_method)}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="block text-xs font-medium text-slate-500">배송 요청 메모</span>
                <span className="mt-0.5 whitespace-pre-wrap text-slate-900">
                  {order.delivery_request_memo?.trim() || "—"}
                </span>
              </div>
            </div>
            <div className="mt-6 border-t border-rose-200/60 pt-5">
              <p className="text-sm font-semibold text-rose-900">리본 문구</p>
              <p className="mt-1 text-xs text-slate-600">
                화환 리본을 좌·우로 나누어 표시합니다. (좌: 경조사어 · 우: 보내는 분)
              </p>
              <div className="mt-3 flex flex-col overflow-hidden rounded-xl border-2 border-rose-300 bg-white shadow-inner sm:flex-row">
                <div className="flex min-h-[5rem] flex-1 flex-col justify-center border-rose-200 px-4 py-3 sm:border-r">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                    경조사어
                  </span>
                  <span className="mt-1 text-sm font-medium text-slate-900 whitespace-pre-wrap break-words">
                    {order.ribbon_message?.trim() || "—"}
                  </span>
                </div>
                <div className="flex min-h-[5rem] flex-1 flex-col justify-center bg-rose-50/60 px-4 py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                    보내는 분
                  </span>
                  <span className="mt-1 text-sm font-medium text-slate-900 whitespace-pre-wrap break-words">
                    {order.ribbon_sender?.trim() || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 뉴런(Newrun) 협회 검색 — 수주화원·상품·옵션 (Phase 3) */}
          <div className="bg-white rounded-lg border border-violet-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">뉴런 발주 — 협회 검색</h2>
            <p className="text-xs text-slate-500 mb-2">
              협회 인트라넷에서 선택 후 이 창으로 돌아오면 아래에 표시되며, 주문에 자동 저장됩니다. (팝업 허용 필요)
            </p>
            <p className="text-xs text-violet-800/90 mb-4 rounded-md bg-violet-50 border border-violet-100 px-2 py-1.5">
              <span className="font-semibold">병합(T3.4):</span> 수주화원은 거래처 기본 → 주문 저장 순으로 합치고, 상품·옵션은{" "}
              <strong>첫 번째 주문 품목</strong>의 상품 기본 → 주문 저장 순입니다. 같은 키는 뒤쪽(주문 저장)이 우선합니다.
            </p>
            <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 space-y-1">
              <p className="font-semibold text-slate-800">intranet_post 발주 상태 (Phase 5)</p>
              <p>
                <span className="font-medium">
                  {formatAdminNewrunSubmitLabel({
                    payment_status: order.payment_status,
                    newrun_submit_status: order.newrun_submit_status,
                    newrun_rwr_result: order.newrun_rwr_result,
                  })}
                </span>
                {order.newrun_submit_status?.trim() ? (
                  <span className="text-slate-500"> (DB: {order.newrun_submit_status})</span>
                ) : null}
                {order.newrun_rwr_result != null && order.newrun_rwr_result !== "" && (
                  <> · 결과코드: {order.newrun_rwr_result}</>
                )}
              </p>
              <p className="text-[11px] text-slate-600 border-t border-slate-100 pt-1">
                발주 필드 요약: <span className="font-mono">rw_sujuid</span>={newrunDispatchSummary.sujuid} ·{" "}
                <span className="font-mono">rw_menucode</span>={newrunDispatchSummary.menucode}
              </p>
              {order.newrun_rwr_orderkey ? (
                <p className="break-all">협회 주문키: {order.newrun_rwr_orderkey}</p>
              ) : null}
              {order.newrun_last_submit_error ? (
                <p className="text-red-700 break-all">마지막 오류: {order.newrun_last_submit_error}</p>
              ) : null}
              {order.newrun_last_submit_at ? (
                <p className="text-slate-500">마지막 시도: {formatDate(order.newrun_last_submit_at)}</p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={newrunSubmitLoading || order.payment_status !== "paid"}
                  onClick={() => void submitNewrunManual(false)}
                  className="h-8 px-3 rounded-md text-xs font-semibold text-white bg-violet-800 hover:bg-violet-900 disabled:opacity-50"
                >
                  {newrunSubmitLoading ? "처리 중…" : "뉴런 발주 실행 (수동)"}
                </button>
                <button
                  type="button"
                  disabled={newrunSubmitLoading || order.payment_status !== "paid"}
                  onClick={() => void submitNewrunManual(true)}
                  className="h-8 px-3 rounded-md text-xs font-medium text-violet-900 bg-violet-100 hover:bg-violet-200 disabled:opacity-50"
                >
                  강제 재시도
                </button>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                결제 완료 직후 자동 발주가 실패한 경우 여기서 재시도합니다. `NEWRUN_ENABLED` / `NEWRUN_MOCK`·환경변수를 확인하세요.
              </p>
            </div>
            {hasNewrunDeliveryCallbackInfo(order.newrun_delivery_info) ? (
              <div className="mb-4 rounded-md border border-teal-200 bg-teal-50/70 px-3 py-2 text-xs text-slate-800 space-y-1">
                <p className="font-semibold text-teal-900">협회 배송 통보 (뉴런 2.6 · Phase 7)</p>
                {(() => {
                  const di = order.newrun_delivery_info!;
                  const st = di.state != null ? String(di.state) : "";
                  const stHint = st ? ADMIN_NEWRUN_DELIVERY_STATE_HINT_LONG[st] ?? `코드 ${st}` : "—";
                  return (
                    <>
                      <p>
                        통보 상태: <span className="font-medium">{st || "—"}</span>
                        {st ? <span className="text-slate-600"> ({stHint})</span> : null}
                      </p>
                      {di.ordercode != null && String(di.ordercode).trim() !== "" ? (
                        <p className="break-all">협회 주문코드: {String(di.ordercode)}</p>
                      ) : null}
                      {di.dica != null && String(di.dica).trim() !== "" ? (
                        <p>
                          배송 이미지:{" "}
                          <a
                            href={String(di.dica)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-800 underline font-medium break-all"
                          >
                            열기
                          </a>
                        </p>
                      ) : null}
                      {di.insuname != null && String(di.insuname).trim() !== "" ? (
                        <p>
                          인수자: {String(di.insuname)}
                          {di.insurel != null && String(di.insurel).trim() !== ""
                            ? ` (${String(di.insurel)})`
                            : null}
                          {(di.insudate1 != null && String(di.insudate1) !== "") ||
                          (di.insudate2 != null && String(di.insudate2) !== "")
                            ? ` · ${[di.insudate1, di.insudate2].filter(Boolean).join(":")}`
                            : null}
                        </p>
                      ) : null}
                      {di.lastCallbackAt != null && String(di.lastCallbackAt).trim() !== "" ? (
                        <p className="text-slate-500">마지막 통보 시각: {formatDate(String(di.lastCallbackAt))}</p>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                disabled={newrunPreviewLoading}
                onClick={() => void loadNewrunPayloadPreview()}
                className="h-9 px-4 rounded-lg text-sm font-medium text-violet-950 bg-violet-200 hover:bg-violet-300 disabled:opacity-50"
              >
                {newrunPreviewLoading ? "불러오는 중…" : "intranet_post 필드 미리보기"}
              </button>
              <button
                type="button"
                disabled={!!newrunOpening}
                onClick={() => openNewrunSearch("florist")}
                className="h-9 px-4 rounded-lg text-sm font-medium text-white bg-violet-700 hover:bg-violet-800 disabled:opacity-50"
              >
                {newrunOpening === "florist" ? "열는 중…" : "수주화원 검색"}
              </button>
              <button
                type="button"
                disabled={!!newrunOpening}
                onClick={() => openNewrunSearch("product")}
                className="h-9 px-4 rounded-lg text-sm font-medium text-violet-900 bg-violet-100 hover:bg-violet-200 disabled:opacity-50"
              >
                {newrunOpening === "product" ? "열는 중…" : "상품 검색"}
              </button>
              <button
                type="button"
                disabled={!!newrunOpening}
                onClick={() => openNewrunSearch("option")}
                className="h-9 px-4 rounded-lg text-sm font-medium text-violet-900 bg-violet-100 hover:bg-violet-200 disabled:opacity-50"
              >
                {newrunOpening === "option" ? "열는 중…" : "옵션 상품 검색"}
              </button>
            </div>
            {newrunPreviewJson ? (
              <div className="mb-4 rounded-md border border-violet-200 bg-violet-50/80 p-3">
                <p className="text-xs font-semibold text-violet-900 mb-2">
                  Phase 4 매핑 결과 (비밀번호 마스킹 · 발주 전 검증은 blockingIssues 참고)
                </p>
                <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap break-all text-slate-800 max-h-64 overflow-y-auto">
                  {newrunPreviewJson}
                </pre>
              </div>
            ) : null}
            <div className="grid gap-3 text-sm">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-600 mb-1">
                  수주화원 — 발주 시 적용(병합)
                </p>
                {effectiveNewrunFlorist ? (
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all text-slate-800">
                    {JSON.stringify(effectiveNewrunFlorist, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-slate-500">거래처 기본·주문 저장 모두 없음</p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  거래처 기본: {order.client?.newrun_default_florist_draft ? "있음" : "없음"} · 주문 저장:{" "}
                  {newrunFloristPayload || order.newrun_florist_draft ? "있음" : "없음"}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-600 mb-1">
                  상품 — 발주 시 적용(병합, 1번 품목)
                </p>
                {effectiveNewrunProduct ? (
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all text-slate-800">
                    {JSON.stringify(effectiveNewrunProduct, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-slate-500">상품 기본·주문 저장 모두 없음</p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  1번 품목 상품 기본:{" "}
                  {items[0]?.product?.newrun_default_product_draft ? "있음" : "없음"} · 주문 저장:{" "}
                  {newrunProductPayload || order.newrun_product_draft ? "있음" : "없음"}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-600 mb-1">
                  옵션 — 발주 시 적용(병합, 1번 품목)
                </p>
                {effectiveNewrunOption ? (
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all text-slate-800">
                    {JSON.stringify(effectiveNewrunOption, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-slate-500">상품 기본·주문 저장 모두 없음</p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  1번 품목 옵션 기본:{" "}
                  {items[0]?.product?.newrun_default_option_draft ? "있음" : "없음"} · 주문 저장:{" "}
                  {newrunOptionPayload || order.newrun_option_draft ? "있음" : "없음"}
                </p>
              </div>
            </div>
          </div>

          {/* 배송지 정보 */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">배송지 정보</h2>
            <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
              <span className="text-slate-600">받는 분</span>
              <span className="text-slate-900">{order.shipping_name ?? "-"}</span>

              <span className="text-slate-600">연락처</span>
              <span className="text-slate-900">{order.shipping_phone ?? "-"}</span>

              <span className="text-slate-600">주소</span>
              <span className="text-slate-900">
                {order.shipping_postcode && `[${order.shipping_postcode}] `}
                {order.shipping_address ?? ""}
                {order.shipping_detail && `, ${order.shipping_detail}`}
              </span>

              <span className="text-slate-600">송장번호</span>
              <span className="font-semibold text-slate-900">
                {formatTrackingDisplay(order.courier_company, order.tracking_number)}
              </span>
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
                    {item.product?.thumbnail_url && (
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
                      {formatPrice(Number(item.unit_price))}원 × {item.quantity}개
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-slate-900">{formatPrice(Number(item.total_price))}원</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-lg font-bold text-slate-900">총 결제금액</span>
              <span className="text-xl font-bold text-slate-900">{formatPrice(Number(order.total_amount))}원</span>
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
                <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                  뉴런 배송 콜백(2.6)이 상태를 자동 갱신할 수 있습니다. 수동 변경과 겹치면 아래 이력 메모를
                  확인하세요.
                </p>
              </div>

              {newrunCourierLocked ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] leading-snug text-amber-950">
                  뉴런 발주·협회 배송 연동 주문입니다. 택배사·송장은 일반 택배가 아닌 협회 배송 흐름을
                  사용하므로 여기서는 수정할 수 없습니다.
                </p>
              ) : null}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">택배사 선택</label>
                <select
                  value={courierCompany}
                  onChange={(e) => setCourierCompany(e.target.value)}
                  disabled={newrunCourierLocked}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:ring-1 focus:ring-slate-600 focus:border-slate-600 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {COURIER_OPTIONS.map((opt) => (
                    <option key={opt.value || "none"} value={opt.value}>
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
                  disabled={newrunCourierLocked}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 text-sm focus:ring-1 focus:ring-slate-600 focus:border-slate-600 disabled:bg-slate-100 disabled:text-slate-500"
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
                {/* updating ? "업데이트 중..." : */}상태 업데이트
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

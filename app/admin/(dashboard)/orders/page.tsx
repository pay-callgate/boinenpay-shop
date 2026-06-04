"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Calendar, Check, ChevronDown, ClipboardList, ListOrdered, Search } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  formatAdminNewrunSubmitLabel,
  type NewrunSubmitListFilter,
} from "@/lib/newrun/admin-order-newrun-summary";
import { toDesiredDeliveryYmd } from "@/lib/admin-florist-order-display";
import { formatPhysicalShippingAddressWithPostcode } from "@/lib/checkout-florist-fields";
import { ADMIN_ORDER_NOTIFY_POLL_MS } from "@/lib/admin-order-notify-poll";

/**
 * 카드 단일 결제 운영: 어드민 기본 목록·집계에서 payment_status=pending 제외(API excludePaymentPending).
 * 무통장 입금 등으로 결제대기 탭을 다시 쓸 때 false로 바꿉니다.
 */
const ADMIN_ORDER_LIST_EXCLUDE_PENDING = true;

/** 상단 `AdminPageHeader`·카테고리 패널과 동일 톤의 목록 요약 헤더 */
const ordersTableSummaryHeaderClass =
  "border-b border-slate-200/80 bg-gradient-to-br from-sky-50/40 via-white to-emerald-50/40 px-5 py-4 sm:px-6 [@media(min-width:768px)_and_(max-height:860px)]:px-4 [@media(min-width:768px)_and_(max-height:860px)]:py-3";

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
  is_guest?: boolean | null;
  orderer_name?: string | null;
  newrun_submit_status?: string | null;
  newrun_rwr_result?: string | null;
  newrun_rwr_orderkey?: string | null;
  newrun_last_submit_at?: string | null;
  desired_delivery_date?: string | null;
  delivery_time_slot?: string | null;
  delivery_method?: string | null;
  delivery_request_memo?: string | null;
  ribbon_sender?: string | null;
  ribbon_message?: string | null;
  shipping_postcode?: string | null;
  shipping_address?: string | null;
  shipping_detail?: string | null;
  order_items?: { product_name?: string | null }[];
  /** Phase 2: /api/orders?withNotify=1 */
  notify_unread_for_me?: boolean;
}

const ORDER_LIST_DEMO_ROWS: Order[] =
  process.env.NODE_ENV === "development"
    ? [
        {
          id: "demo-list-1",
          order_no: "ORD20260511EAC65",
          status: "received",
          payment_status: "paid",
          total_amount: 100000,
          shipping_name: "홍길동",
          created_at: "2026-05-11T06:24:00.000Z",
          client: { id: "c1", name: "데모 거래처", slug: "demo" },
          user: { id: "u1", name: "주문자", email: "a@b.com" },
          is_guest: false,
          orderer_name: "김주문",
          newrun_submit_status: "success",
          newrun_rwr_result: null,
          newrun_rwr_orderkey: "202605-260511DEMOORDERKEY01",
          newrun_last_submit_at: null,
          desired_delivery_date: "2026-05-12",
          delivery_time_slot: "14:00",
          delivery_method: "quick",
          delivery_request_memo: null,
          ribbon_sender: null,
          ribbon_message: null,
          shipping_postcode: "13536",
          shipping_address: "경기 성남시 분당구 데모로 1",
          shipping_detail: "101호",
          order_items: [{ product_name: "근조쌀화환10kg" }],
          notify_unread_for_me: true,
        },
        {
          id: "demo-list-2",
          order_no: "ORD20260510Z9YXW",
          status: "confirmed",
          payment_status: "pending",
          total_amount: 82600,
          shipping_name: "이수령",
          created_at: "2026-05-10T10:00:00.000Z",
          client: { id: "c1", name: "데모 거래처", slug: "demo" },
          user: null,
          is_guest: true,
          orderer_name: null,
          newrun_submit_status: null,
          newrun_rwr_result: null,
          newrun_rwr_orderkey: null,
          newrun_last_submit_at: null,
          desired_delivery_date: "2026-05-13",
          delivery_time_slot: "오전",
          delivery_method: null,
          delivery_request_memo: null,
          ribbon_sender: null,
          ribbon_message: null,
          shipping_postcode: "06234",
          shipping_address: "서울 강남구 테헤란로",
          shipping_detail: "",
          order_items: [{ product_name: "축하화환 대형" }],
          notify_unread_for_me: false,
        },
      ]
    : [];

const NEWRUN_SUBMIT_FILTER_OPTIONS: { value: NewrunSubmitListFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "not_sent", label: "뉴런·미전송(결제완료)" },
  { value: "ok", label: "뉴런·전송완료" },
  { value: "failed", label: "뉴런·실패" },
  { value: "needs_attention", label: "뉴런·확인필요" },
];

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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  refunded: "환불됨",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatOrderListReceivedDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const yy = String(d.getFullYear()).slice(-2);
  return `${yy}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function ymdToYyMmDd(ymd: string | null): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return ymd.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y: string, m: string, day: string) =>
    `${y.slice(-2)}-${m}-${day}`
  );
}

function formatDeliveryRequiredListLine(order: Order): string {
  const ymd = toDesiredDeliveryYmd(order.desired_delivery_date ?? null);
  const datePart = ymdToYyMmDd(ymd);
  const slot =
    typeof order.delivery_time_slot === "string" && order.delivery_time_slot.trim()
      ? order.delivery_time_slot.trim()
      : "";
  if (datePart && slot) return `${datePart} ${slot}`;
  if (datePart) return datePart;
  if (slot) return slot;
  return "—";
}

function formatAssocDispatchListLabel(order: Order): string {
  const raw = formatAdminNewrunSubmitLabel({
    payment_status: order.payment_status,
    newrun_submit_status: order.newrun_submit_status,
    newrun_rwr_result: order.newrun_rwr_result,
  });
  if (raw === "전송완료") return "협회 발주 완료";
  if (raw === "전송완료(중복)") return "협회 발주 완료(중복)";
  return raw;
}

function orderListAddressLine(order: Order): string {
  const line = formatPhysicalShippingAddressWithPostcode(
    order.shipping_postcode,
    order.shipping_address,
    order.shipping_detail
  );
  return line.trim() || "—";
}

function orderListFirstProductName(order: Order): string {
  const n = order.order_items?.[0]?.product_name;
  const s = typeof n === "string" ? n.trim() : "";
  return s || "—";
}

function paymentListPill(order: Order): { label: string; className: string } {
  const base = "inline-block max-w-[11rem] rounded-full px-2.5 py-1 text-xs font-medium";
  if (order.status === "cancelled" || order.payment_status === "refunded" || order.payment_status === "cancelled") {
    return { label: "결제취소", className: `${base} bg-gray-200 text-gray-700` };
  }
  if (order.payment_status === "paid") {
    return {
      label: PAYMENT_STATUS_LABELS.paid,
      className: `${base} bg-black text-white`,
    };
  }
  return {
    label: PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status ?? "—",
    className: `${base} bg-gray-100 text-gray-800`,
  };
}

type FilterState = {
  selectedClient: string;
  selectedStatus: string;
  selectedPaymentStatus: string;
  selectedNewrunSubmit: NewrunSubmitListFilter;
  startDate: string;
  endDate: string;
  desiredDeliveryFrom: string;
  desiredDeliveryTo: string;
};

const EMPTY_FILTERS: FilterState = {
  selectedClient: "",
  selectedStatus: "",
  selectedPaymentStatus: "",
  selectedNewrunSubmit: "all",
  startDate: "",
  endDate: "",
  desiredDeliveryFrom: "",
  desiredDeliveryTo: "",
};

function getUnifiedFilterValue(f: FilterState): string {
  if (f.selectedNewrunSubmit !== "all") return `newrun:${f.selectedNewrunSubmit}`;
  if (f.selectedPaymentStatus) return `pay:${f.selectedPaymentStatus}`;
  if (f.selectedStatus) return `order:${f.selectedStatus}`;
  return "all";
}

function applyUnifiedPick(value: string): Partial<FilterState> {
  if (value === "all") {
    return { selectedStatus: "", selectedPaymentStatus: "", selectedNewrunSubmit: "all" };
  }
  if (value.startsWith("order:")) {
    return {
      selectedStatus: value.slice(6),
      selectedPaymentStatus: "",
      selectedNewrunSubmit: "all",
    };
  }
  if (value.startsWith("pay:")) {
    return {
      selectedStatus: "",
      selectedPaymentStatus: value.slice(4),
      selectedNewrunSubmit: "all",
    };
  }
  if (value.startsWith("newrun:")) {
    return {
      selectedStatus: "",
      selectedPaymentStatus: "",
      selectedNewrunSubmit: value.slice(7) as NewrunSubmitListFilter,
    };
  }
  return {};
}

type QuickTab = "all" | "pending_payment" | "newrun_failed" | "custom";

export default function OrdersPage() {
  const router = useRouter();
  const { status } = useSession();

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState<FilterState>(() => ({ ...EMPTY_FILTERS }));
  const [applied, setApplied] = useState<FilterState>(() => ({ ...EMPTY_FILTERS }));
  const [quickTab, setQuickTab] = useState<QuickTab>("all");
  /** 기본 접힘: 짧은 뷰포트에서 테이블 영역 확보 */
  const [filterDetailExpanded, setFilterDetailExpanded] = useState(false);

  const [countAllOrders, setCountAllOrders] = useState<number | null>(null);
  const [countPendingPayment, setCountPendingPayment] = useState<number | null>(null);
  const [countNewrunFailed, setCountNewrunFailed] = useState<number | null>(null);

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
    async function fetchTabCounts() {
      if (!partnerId) return;
      const base = `/api/orders?partnerId=${partnerId}&limit=1&offset=0`;
      try {
        const ex = ADMIN_ORDER_LIST_EXCLUDE_PENDING ? "&excludePaymentPending=1" : "";
        const [rAll, rPend, rFail] = await Promise.all([
          adminFetch(`${base}&withNotify=1${ex}`),
          adminFetch(`${base}&paymentStatus=pending&withNotify=1`),
          adminFetch(`${base}&newrunSubmit=failed&withNotify=1${ex}`),
        ]);
        const [dAll, dPend, dFail] = await Promise.all([
          rAll.json().catch(() => ({})),
          rPend.json().catch(() => ({})),
          rFail.json().catch(() => ({})),
        ]);
        setCountAllOrders(typeof dAll.total === "number" ? dAll.total : null);
        setCountPendingPayment(typeof dPend.total === "number" ? dPend.total : null);
        setCountNewrunFailed(typeof dFail.total === "number" ? dFail.total : null);
      } catch {
        setCountAllOrders(null);
        setCountPendingPayment(null);
        setCountNewrunFailed(null);
      }
    }
    void fetchTabCounts();
  }, [partnerId]);

  useEffect(() => {
    if (!partnerId) return;

    let alive = true;

    async function fetchOrders(silent: boolean) {
      if (!partnerId) return;
      if (!silent) setLoading(true);

      let url = `/api/orders?partnerId=${partnerId}&limit=${limit}&offset=${offset}`;
      if (applied.selectedClient) url += `&clientId=${applied.selectedClient}`;
      if (applied.selectedStatus) url += `&status=${applied.selectedStatus}`;
      if (applied.selectedPaymentStatus) url += `&paymentStatus=${applied.selectedPaymentStatus}`;
      if (applied.selectedNewrunSubmit && applied.selectedNewrunSubmit !== "all") {
        url += `&newrunSubmit=${applied.selectedNewrunSubmit}`;
      }
      if (applied.startDate) url += `&startDate=${applied.startDate}`;
      if (applied.endDate) url += `&endDate=${applied.endDate}`;
      if (applied.desiredDeliveryFrom) url += `&desiredDeliveryFrom=${applied.desiredDeliveryFrom}`;
      if (applied.desiredDeliveryTo) url += `&desiredDeliveryTo=${applied.desiredDeliveryTo}`;
      if (ADMIN_ORDER_LIST_EXCLUDE_PENDING && !applied.selectedPaymentStatus) {
        url += "&excludePaymentPending=1";
      }
      url += "&withNotify=1";

      try {
        const res = await adminFetch(url);
        if (!alive) return;
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
          setTotal(data.total ?? 0);
        }
      } finally {
        if (alive && !silent) setLoading(false);
      }
    }

    void fetchOrders(false);
    const intervalId = window.setInterval(() => {
      void fetchOrders(true);
    }, ADMIN_ORDER_NOTIFY_POLL_MS);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [
    partnerId,
    applied.selectedClient,
    applied.selectedStatus,
    applied.selectedPaymentStatus,
    applied.selectedNewrunSubmit,
    applied.startDate,
    applied.endDate,
    applied.desiredDeliveryFrom,
    applied.desiredDeliveryTo,
    offset,
  ]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ko-KR").format(price);
  };

  const fmtYmdDot = (v: string) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1.$2.$3") : "—";

  const applySearch = () => {
    const next = { ...draft };
    setApplied(next);
    setOffset(0);
    if (!next.selectedStatus && !next.selectedPaymentStatus && next.selectedNewrunSubmit === "all") {
      setQuickTab("all");
    } else if (
      next.selectedPaymentStatus === "pending" &&
      !next.selectedStatus &&
      next.selectedNewrunSubmit === "all"
    ) {
      setQuickTab("pending_payment");
    } else if (
      next.selectedNewrunSubmit === "failed" &&
      !next.selectedStatus &&
      !next.selectedPaymentStatus
    ) {
      setQuickTab("newrun_failed");
    } else {
      setQuickTab("custom");
    }
  };

  const pickQuickAll = () => {
    const next: FilterState = {
      ...draft,
      selectedStatus: "",
      selectedPaymentStatus: "",
      selectedNewrunSubmit: "all",
    };
    setDraft(next);
    setApplied(next);
    setOffset(0);
    setQuickTab("all");
  };

  const pickQuickPending = () => {
    const next: FilterState = {
      ...draft,
      selectedStatus: "",
      selectedPaymentStatus: "pending",
      selectedNewrunSubmit: "all",
    };
    setDraft(next);
    setApplied(next);
    setOffset(0);
    setQuickTab("pending_payment");
  };

  const pickQuickNewrunFail = () => {
    const next: FilterState = {
      ...draft,
      selectedStatus: "",
      selectedPaymentStatus: "",
      selectedNewrunSubmit: "failed",
    };
    setDraft(next);
    setApplied(next);
    setOffset(0);
    setQuickTab("newrun_failed");
  };

  const newrunListBadge = (order: Order) => {
    const label = formatAssocDispatchListLabel(order);
    const failed = order.newrun_submit_status === "failed";
    const ok =
      order.newrun_submit_status === "success" || order.newrun_submit_status === "duplicate";
    const base = "inline-block max-w-[11rem] truncate rounded-full px-2.5 py-1 text-xs font-medium";
    if (order.payment_status !== "paid") {
      return { label: "—", className: `${base} bg-gray-100 text-gray-600` };
    }
    if (failed) {
      return {
        label: label.length > 24 ? `${label.slice(0, 24)}…` : label,
        className: `${base} bg-red-100 font-bold text-red-700`,
      };
    }
    if (ok) {
      return { label, className: `${base} mt-1 bg-blue-50 text-blue-700` };
    }
    return { label, className: `${base} bg-gray-100 text-gray-800` };
  };

  const handleExcelDownload = async () => {
    if (!partnerId) return;

    let url = `/api/orders/export?partnerId=${partnerId}`;
    if (applied.selectedClient) url += `&clientId=${applied.selectedClient}`;
    if (applied.selectedStatus) url += `&status=${applied.selectedStatus}`;
    if (applied.selectedPaymentStatus) url += `&paymentStatus=${applied.selectedPaymentStatus}`;
    if (applied.selectedNewrunSubmit && applied.selectedNewrunSubmit !== "all") {
      url += `&newrunSubmit=${applied.selectedNewrunSubmit}`;
    }
    if (applied.startDate) url += `&startDate=${applied.startDate}`;
    if (applied.endDate) url += `&endDate=${applied.endDate}`;
    if (applied.desiredDeliveryFrom) url += `&desiredDeliveryFrom=${applied.desiredDeliveryFrom}`;
    if (applied.desiredDeliveryTo) url += `&desiredDeliveryTo=${applied.desiredDeliveryTo}`;
    if (ADMIN_ORDER_LIST_EXCLUDE_PENDING && !applied.selectedPaymentStatus) {
      url += "&excludePaymentPending=1";
    }

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

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = total === 0 ? 1 : Math.min(totalPages, Math.floor(offset / limit) + 1);
  const monthNum = String(new Date().getMonth() + 1).padStart(2, "0");
  const listMonthTitle = `${monthNum}월 주문 목록`;
  const summaryAmountExact =
    !loading && total > 0 && orders.length === total
      ? orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
      : null;
  const summaryAmountText =
    summaryAmountExact == null ? "—" : `${formatPrice(summaryAmountExact)} 원`;

  const isDemoSubstitute =
    process.env.NODE_ENV === "development" &&
    orders.length === 0 &&
    ORDER_LIST_DEMO_ROWS.length > 0;
  const rowsForDisplay = isDemoSubstitute ? ORDER_LIST_DEMO_ROWS : orders;

  if (status === "loading" || !partnerId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 px-4 py-4 sm:p-6 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-600"></p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 px-4 py-4 sm:p-6 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
      {/* [2] 상단 고정: 타이틀·필터 (스크롤 시 찌그러짐 방지) */}
      <div className="shrink-0">
        <AdminPageHeader
          className="shrink-0 [@media(min-width:768px)_and_(max-height:860px)]:!mb-2 [@media(min-width:768px)_and_(max-height:860px)]:!rounded-lg [@media(min-width:768px)_and_(max-height:860px)]:!px-3 [@media(min-width:768px)_and_(max-height:860px)]:!py-2 [@media(min-width:768px)_and_(max-height:620px)]:!py-1.5"
          eyebrowClassName="[@media(min-width:768px)_and_(max-height:620px)]:hidden"
          titleClassName="[@media(min-width:768px)_and_(max-height:860px)]:!mt-0 [@media(min-width:768px)_and_(max-height:860px)]:!text-lg"
          iconClassName="[@media(min-width:768px)_and_(max-height:860px)]:!h-5 [@media(min-width:768px)_and_(max-height:860px)]:!w-5"
          descriptionClassName="[@media(min-width:768px)_and_(max-height:860px)]:hidden"
          eyebrow="Orders · List"
          title="주문 목록"
          titleIcon={ClipboardList}
          description={
            <span className="break-keep [word-break:keep-all]">
              쇼핑몰의 전체 주문 내역을 검색과 필터로 빠르게 찾고, 주문의 결제 및 배송 상태를 관리합니다.
            </span>
          }
        />

        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm [@media(min-width:768px)_and_(max-height:860px)]:mb-2 [@media(min-width:768px)_and_(max-height:860px)]:p-2">
          <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-800 [@media(min-width:768px)_and_(max-height:860px)]:px-2 [@media(min-width:768px)_and_(max-height:860px)]:py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 [@media(min-width:768px)_and_(max-height:860px)]:gap-y-1.5">
              <select
                value={draft.selectedClient}
                onChange={(e) => setDraft((d) => ({ ...d, selectedClient: e.target.value }))}
                className="h-9 w-auto min-w-[9rem] max-w-[11rem] shrink-0 rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 [@media(min-width:768px)_and_(max-height:860px)]:h-8 [@media(min-width:768px)_and_(max-height:860px)]:text-xs"
              >
                <option value="">거래처 선택</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <select
                value={getUnifiedFilterValue(draft)}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, ...applyUnifiedPick(e.target.value) }))
                }
                className="h-9 w-auto min-w-[9.5rem] max-w-[12.5rem] shrink-0 rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 [@media(min-width:768px)_and_(max-height:860px)]:h-8 [@media(min-width:768px)_and_(max-height:860px)]:text-xs"
              >
                <option value="all">상태 통합검색</option>
                <optgroup label="주문 상태">
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={`order:${value}`}>
                      {label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="결제">
                  {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={`pay:${value}`}>
                      {label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="뉴런 발주">
                  {NEWRUN_SUBMIT_FILTER_OPTIONS.filter((o) => o.value !== "all").map(
                    ({ value, label }) => (
                      <option key={value} value={`newrun:${value}`}>
                        {label}
                      </option>
                    )
                  )}
                </optgroup>
              </select>
              <button
                type="button"
                onClick={applySearch}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-black px-4 text-sm font-semibold whitespace-nowrap text-white hover:bg-gray-800 [@media(min-width:768px)_and_(max-height:860px)]:h-8 [@media(min-width:768px)_and_(max-height:860px)]:px-3 [@media(min-width:768px)_and_(max-height:860px)]:text-xs"
              >
                검색
                <Search className="h-4 w-4 shrink-0" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setFilterDetailExpanded((v) => !v)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold whitespace-nowrap transition-colors sm:text-sm [@media(min-width:768px)_and_(max-height:860px)]:h-8 [@media(min-width:768px)_and_(max-height:860px)]:px-2 [@media(min-width:768px)_and_(max-height:860px)]:text-xs ${
                  filterDetailExpanded
                    ? "border-slate-900 bg-white text-slate-900"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                aria-expanded={filterDetailExpanded}
              >
                <Calendar className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                기간·희망배송
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                    filterDetailExpanded ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>
              <div className="ml-auto flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={handleExcelDownload}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 [@media(min-width:768px)_and_(max-height:860px)]:h-8 [@media(min-width:768px)_and_(max-height:860px)]:px-3 [@media(min-width:768px)_and_(max-height:860px)]:text-xs"
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
            </div>

            {filterDetailExpanded ? (
              <div className="mt-3 border-t border-slate-200/90 pt-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">기간 설정</div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
                  <span className="w-12 shrink-0 text-xs font-medium text-slate-500 sm:w-14">주문</span>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                    className="h-9 shrink-0 rounded border border-slate-200 bg-white px-2 text-sm sm:min-w-[7.5rem]"
                  />
                  <span className="shrink-0 text-slate-400">~</span>
                  <input
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                    className="h-9 shrink-0 rounded border border-slate-200 bg-white px-2 text-sm sm:min-w-[7.5rem]"
                  />
                  <span
                    className="mx-1 hidden shrink-0 text-slate-300 sm:inline"
                    aria-hidden
                  >
                    |
                  </span>
                  <span className="w-12 shrink-0 text-xs font-medium text-slate-500 sm:w-14">
                    희망배송
                  </span>
                  <input
                    type="date"
                    value={draft.desiredDeliveryFrom}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, desiredDeliveryFrom: e.target.value }))
                    }
                    className="h-9 shrink-0 rounded border border-slate-200 bg-white px-2 text-sm sm:min-w-[7.5rem]"
                  />
                  <span className="shrink-0 text-slate-400">~</span>
                  <input
                    type="date"
                    value={draft.desiredDeliveryTo}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, desiredDeliveryTo: e.target.value }))
                    }
                    className="h-9 shrink-0 rounded border border-slate-200 bg-white px-2 text-sm sm:min-w-[7.5rem]"
                  />
                </div>
              </div>
            ) : null}

            <span className="sr-only">
              {fmtYmdDot(draft.startDate)} ~ {fmtYmdDot(draft.endDate)}, 희망 배송{" "}
              {fmtYmdDot(draft.desiredDeliveryFrom)} ~ {fmtYmdDot(draft.desiredDeliveryTo)}
            </span>
          </div>
        </div>
      </div>

      {/* [3] 테이블 카드: 최소 높이 방어 + 데스크톱은 내부 스크롤 */}
      <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div
          className={`flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 [@media(min-width:768px)_and_(max-height:860px)]:gap-y-2 ${ordersTableSummaryHeaderClass}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90 sm:text-xs">
              Orders · Summary
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 sm:text-xl [@media(min-width:768px)_and_(max-height:860px)]:text-lg">
                <ListOrdered
                  className="h-5 w-5 shrink-0 text-emerald-600 sm:h-6 sm:w-6"
                  strokeWidth={1.75}
                  aria-hidden
                />
                {listMonthTitle}
              </h2>
              {!loading ? (
                <span className="text-xs text-slate-600 sm:text-sm">
                  총발주 수: {total}건 ( {summaryAmountText} )
                </span>
              ) : (
                <span className="text-xs text-slate-400 sm:text-sm">불러오는 중…</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 sm:ml-auto sm:gap-4 [@media(min-width:768px)_and_(max-height:860px)]:gap-2">
            <button
              type="button"
              onClick={pickQuickAll}
              className={`text-sm transition-colors ${
                quickTab === "all"
                  ? "border-b-2 border-emerald-600 pb-1 font-semibold text-slate-900"
                  : "font-normal text-slate-500 hover:text-slate-800"
              }`}
            >
              전체{countAllOrders != null ? ` ${countAllOrders}건` : ""}
            </button>
            {!ADMIN_ORDER_LIST_EXCLUDE_PENDING ? (
              <button
                type="button"
                onClick={pickQuickPending}
                className={`text-sm transition-colors ${
                  quickTab === "pending_payment"
                    ? "border-b-2 border-emerald-600 pb-1 font-semibold text-slate-900"
                    : "font-normal text-slate-500 hover:text-slate-800"
                }`}
              >
                결제대기{countPendingPayment != null ? ` ${countPendingPayment}` : ""}
              </button>
            ) : null}
            <button
              type="button"
              onClick={pickQuickNewrunFail}
              className={`inline-flex items-center gap-1 text-sm font-semibold ${
                quickTab === "newrun_failed"
                  ? "rounded-full bg-orange-50 px-3 py-1.5 text-orange-700 ring-2 ring-orange-200"
                  : "rounded-full bg-orange-50 px-3 py-1.5 text-orange-700 hover:bg-orange-100"
              }`}
            >
              <Bell className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              뉴런 발주 실패{countNewrunFailed != null ? ` ${countNewrunFailed}` : ""}
            </button>
          </div>
        </div>

        {/* 모바일: 카드 목록 */}
        <div className="scrollbar-thin flex-1 overflow-y-auto pb-4 md:hidden">
          <div className="space-y-3 p-3 pb-4">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">불러오는 중…</p>
            ) : rowsForDisplay.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">주문 내역이 없습니다.</p>
            ) : (
              rowsForDisplay.map((order) => {
                const pay = paymentListPill(order);
                const nr = newrunListBadge(order);
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      if (order.id.startsWith("demo-list-")) return;
                      router.push(`/admin/orders/${order.id}`);
                    }}
                    className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs text-slate-600">{order.order_no}</span>
                      {order.notify_unread_for_me ? (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          New
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {orderListFirstProductName(order)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {orderListAddressLine(order)}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      {formatOrderListReceivedDateTime(order.created_at)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-orange-600">
                      {formatDeliveryRequiredListLine(order)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {formatPrice(Number(order.total_amount) || 0)} 원
                      </span>
                      <span className={pay.className}>{pay.label}</span>
                      <span className={nr.className}>{nr.label}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 데스크톱: 테이블 + 세로 스크롤 */}
        <div className="scrollbar-thin hidden min-h-0 flex-1 overflow-y-auto pb-4 md:flex md:flex-col">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
              <tr>
                <th className="border-y border-gray-200 px-4 py-3 text-left text-xs font-semibold whitespace-nowrap text-gray-500">
                  주문번호
                </th>
                <th className="border-y border-gray-200 px-4 py-3 text-left text-xs font-semibold whitespace-nowrap text-gray-500">
                  확인
                </th>
                <th className="border-y border-gray-200 px-4 py-3 text-left text-xs font-semibold whitespace-nowrap text-gray-500">
                  주문접수일 / 배송요구일
                </th>
                <th className="border-y border-gray-200 px-4 py-3 text-left text-xs font-semibold whitespace-nowrap text-gray-500">
                  주문상품명 / 배송지
                </th>
                <th className="border-y border-gray-200 px-4 py-3 text-left text-xs font-semibold whitespace-nowrap text-gray-500">
                  결제금액
                </th>
                <th className="border-y border-gray-200 px-4 py-3 text-left text-xs font-semibold whitespace-nowrap text-gray-500">
                  주문 및 발주 현황
                </th>
                <th className="border-y border-gray-200 px-4 py-3 text-left text-xs font-semibold whitespace-nowrap text-gray-500">
                  협회주문번호
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : rowsForDisplay.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    주문 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                rowsForDisplay.map((order) => {
                  const pay = paymentListPill(order);
                  const nr = newrunListBadge(order);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => {
                        if (order.id.startsWith("demo-list-")) return;
                        router.push(`/admin/orders/${order.id}`);
                      }}
                      className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3 align-top">
                        <span className="text-xs font-normal text-gray-500">{order.order_no}</span>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {order.notify_unread_for_me ? (
                          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            New
                          </span>
                        ) : (
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200/90 bg-emerald-50 shadow-sm shadow-emerald-100/60"
                            title="확인 완료"
                            aria-label="확인 완료"
                          >
                            <Check
                              className="h-3 w-3 shrink-0 text-emerald-600/90"
                              strokeWidth={2.25}
                              aria-hidden
                            />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-700">
                            {formatOrderListReceivedDateTime(order.created_at)}
                          </span>
                          <span className="mt-1 text-sm font-bold text-orange-600">
                            {formatDeliveryRequiredListLine(order)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex max-w-[240px] flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {orderListFirstProductName(order)}
                          </span>
                          <span
                            className="mt-1 max-w-[200px] truncate text-xs text-gray-500"
                            title={orderListAddressLine(order)}
                          >
                            {orderListAddressLine(order)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="block text-right text-sm font-bold text-gray-900">
                          {formatPrice(Number(order.total_amount) || 0)} 원
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <span className={pay.className}>{pay.label}</span>
                          <span
                            className={nr.className}
                            title={formatAssocDispatchListLabel(order)}
                          >
                            {nr.label}
                            {order.newrun_submit_status === "failed" ? " 🚨" : ""}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="text-xs text-gray-400">
                          {order.newrun_rwr_orderkey?.trim() || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
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

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { adminFetch } from "@/lib/admin-fetch";
import {
  mergeFloristDraftForOrder,
  mergeProductDraftForOrder,
} from "@/lib/newrun/merge-order-drafts";
import { isKakaoTalkInAppBrowser } from "@/lib/kakao-in-app-browser";
import { isNewrunCourierReadOnly } from "@/lib/newrun/admin-newrun-courier-lock";
import { getAdminLocalTodayYmd, isDesiredDeliveryToday } from "@/lib/admin-florist-order-display";
import { NEWRUN_BUILTIN_DEFAULT_RW_SUJUID } from "@/lib/newrun/map-order-to-newrun-payload";
import { OrderDetailHeader } from "@/components/admin/order-detail/OrderDetailHeader";
import { OrderProductCard } from "@/components/admin/order-detail/OrderProductCard";
import { OrderFloristRibbonCard } from "@/components/admin/order-detail/OrderFloristRibbonCard";
import { OrderRecipientCard } from "@/components/admin/order-detail/OrderRecipientCard";
import { OrderPaymentCancelCard } from "@/components/admin/order-detail/OrderPaymentCancelCard";
import { OrderStatusPanel } from "@/components/admin/order-detail/OrderStatusPanel";
import { OrderOrdererCard } from "@/components/admin/order-detail/OrderOrdererCard";
import { OrderHistoryTimeline } from "@/components/admin/order-detail/OrderHistoryTimeline";
import { OrderNewrunAccordion } from "@/components/admin/order-detail/OrderNewrunAccordion";
import { OrderDetailNewrunPanel } from "@/components/admin/order-detail/OrderDetailNewrunPanel";

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
  partner_id?: string;
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
  ribbon_message_kind?: string | null;
  ribbon_card_message?: string | null;
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

  const [partnerPaymentCancel, setPartnerPaymentCancel] = useState<{
    allowed: boolean;
    message: string | null;
    test_bypass?: boolean;
  } | null>(null);
  const [paymentCancelReason, setPaymentCancelReason] = useState("");
  const [paymentCancelSubmitting, setPaymentCancelSubmitting] = useState(false);

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
      NEWRUN_BUILTIN_DEFAULT_RW_SUJUID;
    const menucode =
      p?.rw_menucode?.trim() ||
      p?.var_menucode?.trim() ||
      p?.goodcode?.trim() ||
      p?.var_goodcode?.trim() ||
      "";
    return { sujuid: sujuid || "—", menucode: menucode || "—" };
  }, [effectiveNewrunFlorist, effectiveNewrunProduct]);

  const persistNewrunDraft = React.useCallback(
    async (kind: "florist" | "product" | "option", payload: Record<string, string> | null) => {
      if (!orderId) return;
      const res = await adminFetch(`/api/partner/orders/${orderId}/newrun-draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, payload }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error || "뉴런 선택값 저장에 실패했습니다. 다시 시도해 주세요.");
        return false;
      }
      return true;
    },
    [orderId]
  );

  const resetNewrunFloristOrderDraft = React.useCallback(async () => {
    if (!orderId || !order) return;
    const ok = window.confirm(
      `주문에만 저장된 수주화원 선택을 지웁니다. 거래처 기본 draft가 없으면 발주 시 ${NEWRUN_BUILTIN_DEFAULT_RW_SUJUID}(기본)이 쓰입니다. 계속할까요?`
    );
    if (!ok) return;
    const saved = await persistNewrunDraft("florist", null);
    if (!saved) return;
    setNewrunFloristPayload(null);
    setOrder((prev) => (prev ? { ...prev, newrun_florist_draft: null } : null));
  }, [orderId, order, persistNewrunDraft]);

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
      const path = `/api/partner/integrations/newrun/open-search?kind=${encodeURIComponent(
        kind
      )}&orderId=${encodeURIComponent(orderId)}`;
      /** 동일 출처 진입 후 서버 302 → 협회 HTTP. `noopener` 없음: var_ret가 opener.postMessage 사용 */
      const popup = window.open(path, "_blank", "width=1100,height=800");
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
        setPartnerPaymentCancel(data.partner_payment_cancel ?? null);
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

  useEffect(() => {
    if (!order?.id || !order.partner_id) return;
    void adminFetch("/api/partner/order-notifications/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId: order.partner_id,
        orderId: order.id,
      }),
    });
  }, [order?.id, order?.partner_id]);

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

  const handlePaymentCancel = async () => {
    if (!order || paymentCancelSubmitting) return;
    const paymentTestBypass = partnerPaymentCancel?.test_bypass === true;
    if (!partnerPaymentCancel?.allowed && !paymentTestBypass) {
      alert(partnerPaymentCancel?.message || "지금은 결제 취소를 할 수 없습니다.");
      return;
    }
    const reason = paymentCancelReason.trim();
    if (reason.length < 4) {
      alert("취소 사유를 4자 이상 입력해 주세요.");
      return;
    }
    if (order.status === "shipping") {
      const okShip = window.confirm(
        "배송이 이미 출발한 건입니다. 배송비 차감이 필요한 경우 시스템 취소 후 PG사 관리자 페이지에서 부분 환불을 진행해 주세요. 취소하시겠습니까?"
      );
      if (!okShip) return;
    }
    if (!window.confirm("주문이 취소됩니다. 진행하시겠습니까?")) {
      return;
    }
    setPaymentCancelSubmitting(true);
    try {
      const res = await adminFetch(`/api/admin/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        alert(data.idempotent ? "이미 취소된 주문입니다." : "결제 취소 및 주문 취소가 완료되었습니다.");
        window.location.reload();
        return;
      }
      alert(data.error || data.message || "취소 처리에 실패했습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setPaymentCancelSubmitting(false);
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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-gray-50 p-6 text-gray-900 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">불러오는 중…</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-gray-50 p-6 text-gray-900 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
        <div className="flex flex-col items-center justify-center py-12">
          <h1 className="mb-2 text-xl font-bold text-gray-900">주문을 찾을 수 없습니다</h1>
          <button
            type="button"
            onClick={() => router.push("/admin/orders")}
            className="mt-4 h-10 rounded-lg bg-black px-6 text-sm font-medium text-white hover:bg-gray-800"
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-gray-50 p-6 text-gray-900 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
      <OrderDetailHeader status={order.status} />

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-10 [@media(min-width:768px)_and_(max-height:860px)]:gap-3">
        <div className="flex flex-col gap-6 lg:col-span-7 [@media(min-width:768px)_and_(max-height:860px)]:gap-3">
          <OrderProductCard
            orderNo={order.order_no}
            items={items}
            totalAmount={order.total_amount}
            formatPrice={formatPrice}
          />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 [@media(min-width:768px)_and_(max-height:860px)]:gap-3">
            <OrderOrdererCard
              user={order.user}
              isGuest={order.is_guest}
              ordererName={order.orderer_name}
              guestOrdererEmail={order.guest_orderer_email}
              shippingPhone={order.shipping_phone}
              paymentMethod={order.payment_method}
              paymentStatus={order.payment_status}
              createdAt={order.created_at}
              formatDate={formatDate}
            />
            <OrderRecipientCard
              name={order.shipping_name}
              phone={order.shipping_phone ?? ""}
              postcode={order.shipping_postcode}
              address={order.shipping_address}
              addressDetail={order.shipping_detail}
            />
          </div>
          <OrderFloristRibbonCard
            desiredDeliveryDate={order.desired_delivery_date}
            deliveryTimeSlot={order.delivery_time_slot}
            deliveryMethod={order.delivery_method}
            deliveryRequestMemo={order.delivery_request_memo}
            ribbonSender={order.ribbon_sender}
            ribbonMessage={order.ribbon_message}
            ribbonCardMessage={order.ribbon_card_message}
            floristDesiredDeliveryIsToday={floristDesiredDeliveryIsToday}
          />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-3 [@media(min-width:768px)_and_(max-height:860px)]:gap-3">
          <div className="lg:sticky lg:top-6">
            <div className="flex flex-col gap-6 [@media(min-width:768px)_and_(max-height:860px)]:gap-3">
              {/*
               * 주문 상태 업데이트: 화면 비노출(DOM·상태·핸들러 유지, 추후 재사용)
               */}
              <div className="hidden" aria-hidden="true">
                <OrderStatusPanel
                  newStatus={newStatus}
                  onStatusChange={setNewStatus}
                  courierCompany={courierCompany}
                  onCourierChange={setCourierCompany}
                  trackingNumber={trackingNumber}
                  onTrackingChange={setTrackingNumber}
                  memo={memo}
                  onMemoChange={setMemo}
                  onSubmit={handleStatusUpdate}
                  updating={updating}
                  newrunCourierLocked={newrunCourierLocked}
                />
              </div>
              <OrderHistoryTimeline history={history} formatDate={formatDate} />
              <OrderPaymentCancelCard
                partnerPaymentCancel={partnerPaymentCancel}
                paymentCancelReason={paymentCancelReason}
                onReasonChange={setPaymentCancelReason}
                paymentCancelSubmitting={paymentCancelSubmitting}
                onSubmitCancel={() => void handlePaymentCancel()}
                orderPaymentStatus={order.payment_status}
                orderStatus={order.status}
              />
            </div>
          </div>
        </div>

        <div className="col-span-full">
          <OrderNewrunAccordion>
            <OrderDetailNewrunPanel
              order={order}
              items={items}
              newrunDispatchSummary={newrunDispatchSummary}
              effectiveNewrunFlorist={effectiveNewrunFlorist}
              effectiveNewrunProduct={effectiveNewrunProduct}
              effectiveNewrunOption={effectiveNewrunOption}
              newrunFloristPayload={newrunFloristPayload}
              newrunProductPayload={newrunProductPayload}
              newrunOptionPayload={newrunOptionPayload}
              newrunPreviewJson={newrunPreviewJson}
              newrunPreviewLoading={newrunPreviewLoading}
              newrunSubmitLoading={newrunSubmitLoading}
              newrunOpening={newrunOpening}
              formatDate={formatDate}
              loadNewrunPayloadPreview={() => void loadNewrunPayloadPreview()}
              submitNewrunManual={(force) => void submitNewrunManual(force)}
              openNewrunSearch={(kind) => void openNewrunSearch(kind)}
              resetNewrunFloristOrderDraft={() => void resetNewrunFloristOrderDraft()}
            />
          </OrderNewrunAccordion>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  ChevronRight,
  CircleCheck,
  Copy,
  List,
  MapPin,
  MessageCircle,
  ShoppingBag,
  User,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";
import { toDesiredDeliveryYmd } from "@/lib/admin-florist-order-display";
import { formatFloristShippingAddressForCustomerUI } from "@/lib/checkout-florist-fields";
import {
  collectViewpayPgReturnSnapshot,
  logViewpayPgReturnSnapshot,
} from "@/lib/viewpay";
import { resolveViewpayFailureRedirectPath } from "@/lib/resolve-checkout-return-url";

/**
 * Phase E1: 주문 완료 페이지 (ViewPay returnUrl 리다이렉트 대상)
 * Query: orderId, cgTid(또는 tid 등) → complete API 호출 후 주문 상세 조회하여 실제 데이터 표시
 */

/** GET /api/orders/[id] 응답의 주문 항목 */
interface OrderItemRow {
  id: string;
  product_name: string;
  option_json: Record<string, string> | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnail_url: string | null;
  };
}

/** GET /api/orders/[id] 응답의 주문 정보 */
interface OrderDetailOrder {
  id: string;
  order_no: string;
  total_amount: number;
  payment_status: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_postcode: string | null;
  shipping_address: string;
  shipping_detail: string | null;
  desired_delivery_date?: string | null;
  delivery_time_slot?: string | null;
  ribbon_sender?: string | null;
  ribbon_message?: string | null;
  orderer_name?: string | null;
  client: { id: string; name: string; slug: string; logo_url: string | null };
}

/** 주문 완료 화면용: YYYY-MM-DD + 시간대 한 줄 */
function formatDeliveryHopeLine(
  desiredDate: string | null | undefined,
  timeSlot: string | null | undefined
): string {
  const ymd = toDesiredDeliveryYmd(desiredDate ?? null);
  const slot =
    typeof timeSlot === "string" && timeSlot.trim() ? timeSlot.trim() : "";
  if (ymd && slot) return `${ymd} ${slot}`;
  if (ymd) return ymd;
  if (slot) return slot;
  return "—";
}

/** 스냅샷: 아이콘 + 라벨(회색) + 값(본문) */
function DeliveryInfoRow({
  icon: Icon,
  label,
  children,
  valueBold,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  /** 배송 희망일·리본 메시지 등 강조 */
  valueBold?: boolean;
}) {
  return (
    <div className="flex gap-3 border-b border-violet-100/70 pb-5 last:border-b-0 last:pb-0 break-keep [word-break:keep-all]">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: PRIMARY_LIGHT }}
      >
        <Icon
          className="h-[1.15rem] w-[1.15rem]"
          strokeWidth={2}
          style={{ color: PRIMARY }}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-xs font-medium tracking-tight text-slate-500">{label}</p>
        <div
          className={`mt-1 text-sm text-gray-900 ${
            valueBold ? "font-bold" : "font-medium"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const PRIMARY = "#D6A8E0";
const PRIMARY_LIGHT = "#F3E8F5";
const BG_PAGE = "#F9FAFB";

/** 쿼리/해시에서 결제 거래 ID 추출 (ViewPay cgTid / tid / paymentId 등) */
function getPaymentIdFromSearch(searchParams: URLSearchParams | null): string {
  if (!searchParams) return "";

  const names = ["cgTid", "tid", "tId", "paymentId", "transactionId", "cg_tid"];
  for (const name of names) {
    const v = searchParams.get(name)?.trim();
    if (v) return v;
  }

  const dataParam = searchParams.get("data");
  if (!dataParam) return "";

  try {
    const parsed = JSON.parse(dataParam) as {
      event?: { data?: { cgTid?: string; tid?: string; tId?: string } };
      data?: { cgTid?: string; tid?: string; tId?: string };
      cgTid?: string;
    };

    const fromEventData =
      parsed?.event?.data?.cgTid ??
      parsed?.event?.data?.tid ??
      parsed?.event?.data?.tId;
    if (fromEventData && typeof fromEventData === "string") {
      return fromEventData.trim();
    }

    const fromRootData =
      parsed?.data?.cgTid ?? parsed?.data?.tid ?? parsed?.data?.tId ?? parsed?.cgTid;
    if (fromRootData && typeof fromRootData === "string") {
      return fromRootData.trim();
    }
  } catch {
    // ignore
  }

  return "";
}

function getPaymentIdFromHash(): string {
  if (typeof window === "undefined" || !window.location.hash) return "";
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return getPaymentIdFromSearch(params);
}

type CompleteState = "idle" | "loading" | "success" | "redirecting";

const whiteCardClass = "mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-sm";

/** webhook·PG 복귀 지연 대비 sync-status 폴링 */
const SYNC_STATUS_POLL_MS = 2500;
const SYNC_STATUS_MAX_POLLS = 24;

export default function OrderCompletePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const orderId = searchParams?.get("orderId")?.trim() ?? "";
  const cgTidFromQuery = getPaymentIdFromSearch(searchParams);
  const guestToken = searchParams?.get("guestToken")?.trim() ?? "";
  const guestSig = searchParams?.get("sig")?.trim() ?? "";
  const guestOrderQs =
    guestToken && guestSig
      ? `&guestToken=${encodeURIComponent(guestToken)}&sig=${encodeURIComponent(guestSig)}`
      : "";

  const [cgTid, setCgTid] = useState(cgTidFromQuery);
  const [hashChecked, setHashChecked] = useState(false);

  const [state, setState] = useState<CompleteState>("idle");
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<{
    order: OrderDetailOrder;
    items: OrderItemRow[];
  } | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

  const syncPollStarted = useRef(false);
  const pgReturnLogged = useRef(false);

  useEffect(() => {
    if (pgReturnLogged.current || typeof window === "undefined") return;
    pgReturnLogged.current = true;
    const snapshot = collectViewpayPgReturnSnapshot(searchParams);
    logViewpayPgReturnSnapshot("order/complete 마운트 — PG returnUrl 복귀", snapshot);
  }, [searchParams]);

  const fetchSyncStatus = async (opts?: { cgTidForSync?: string }) => {
    const qs = new URLSearchParams({ orderId, sync: "1" });
    if (guestToken && guestSig) {
      qs.set("guestToken", guestToken);
      qs.set("sig", guestSig);
    }
    if (opts?.cgTidForSync?.trim()) {
      qs.set("cgTid", opts.cgTidForSync.trim());
    }
    const res = await shopFetch(`/api/payment/viewpay/sync-status?${qs.toString()}`, {
      handleSessionExpiry: guestOrderQs.length === 0,
    });
    return res.json().catch(() => ({})) as Promise<Record<string, unknown>>;
  };

  useEffect(() => {
    if (state !== "success" || !orderNo || !orderId) return;
    if (typeof window === "undefined") return;
    const key = `shop_order_receipt_toast_${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage 불가 시에도 토스트 1회 시도
    }
    toast(`주문이 접수되었습니다. 주문번호 ${orderNo}`, "success");
  }, [state, orderNo, orderId]);

  // 결제 완료 성공 시 주문 상세 조회 (실제 데이터)
  useEffect(() => {
    if (state !== "success" || !orderId) return;
    let cancelled = false;
    setOrderDetailLoading(true);
    setOrderDetail(null);
    const orderUrl =
      guestOrderQs.length > 0
        ? `/api/orders/${orderId}?guestToken=${encodeURIComponent(guestToken)}&sig=${encodeURIComponent(guestSig)}`
        : `/api/orders/${orderId}`;
    shopFetch(orderUrl, { handleSessionExpiry: guestOrderQs.length === 0 })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.order && Array.isArray(data.items)) {
          setOrderDetail({ order: data.order, items: data.items });
        }
      })
      .finally(() => {
        if (!cancelled) setOrderDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state, orderId, guestToken, guestSig, guestOrderQs.length]);

  useEffect(() => {
    if (cgTidFromQuery) {
      setCgTid(cgTidFromQuery);
      setHashChecked(true);
      return;
    }
    if (typeof window !== "undefined") {
      const fromHash = getPaymentIdFromHash();
      if (fromHash) setCgTid(fromHash);
      setHashChecked(true);
    }
  }, [cgTidFromQuery]);

  useEffect(() => {
    if (!hashChecked && !cgTidFromQuery) setHashChecked(true);
  }, [hashChecked, cgTidFromQuery]);

  const redirectToPaymentOutcome = (payload: Record<string, unknown>, fallbackMessage?: string) => {
    setState("redirecting");
    const enriched: Record<string, unknown> = {
      ...payload,
      message:
        (payload.message as string | undefined) ??
        fallbackMessage ??
        "결제가 완료되지 않았습니다.",
    };
    if (!enriched.outcome) {
      enriched.outcome = "system_error";
    }
    const path = resolveViewpayFailureRedirectPath({
      subdomain,
      clientSlug,
      orderId,
      payload: enriched,
      guestToken: guestToken || undefined,
      guestSig: guestSig || undefined,
    });
    router.replace(path);
  };

  const applyCompletePayload = (data: Record<string, unknown>) => {
    if (data?.success && data?.orderNo) {
      const nr = data.newrun as { success?: boolean; message?: string; skipped?: boolean } | undefined;
      if (nr && nr.success === false && nr.message) {
        toast(nr.message, "error");
        alert(nr.message);
      } else if (nr?.skipped && nr.message && typeof window !== "undefined") {
        console.info("[OrderComplete] Newrun:", nr.message);
      }
      setOrderNo(data.orderNo as string);
      setState("success");
    } else {
      redirectToPaymentOutcome(data);
    }
  };

  useEffect(() => {
    if (!orderId || !cgTid || !partner?.id || !client?.id) {
      return;
    }
    let cancelled = false;
    setState("loading");
    const url = `/api/payment/viewpay/complete?orderId=${encodeURIComponent(orderId)}&cgTid=${encodeURIComponent(cgTid)}${guestOrderQs}`;
    shopFetch(url, { handleSessionExpiry: guestOrderQs.length === 0 })
      .then((res) => res.json().catch(() => ({})))
      .then(async (data) => {
        if (cancelled) return;
        const payload = data as Record<string, unknown>;
        console.log("[ViewPay:PGReturn] complete API 응답", {
          orderId,
          cgTid,
          success: payload?.success,
          orderNo: payload?.orderNo,
          message: payload?.message,
          newrun: payload?.newrun,
          raw: payload,
        });
        if (payload?.success && payload?.orderNo) {
          applyCompletePayload(payload);
          return;
        }
        const syncData = await fetchSyncStatus({ cgTidForSync: cgTid });
        if (cancelled) return;
        console.log("[ViewPay:PGReturn] sync-status 폴백 응답", {
          orderId,
          cgTid,
          syncData,
        });
        if (syncData?.success && syncData?.status === "paid" && syncData?.orderNo) {
          applyCompletePayload(syncData);
          return;
        }
        applyCompletePayload(payload);
      })
      .catch(async (err) => {
        if (cancelled) return;
        try {
          const syncData = await fetchSyncStatus({ cgTidForSync: cgTid });
          if (syncData?.success && syncData?.status === "paid" && syncData?.orderNo) {
            applyCompletePayload(syncData);
            return;
          }
        } catch {
          // fall through
        }
        redirectToPaymentOutcome(
          { outcome: "system_error" },
          err?.message ?? "결제 완료 확인 중 오류가 발생했습니다."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, cgTid, partner?.id, client?.id, guestOrderQs]);

  /** cgTid 없음: sync-status 폴링 (webhook 반영 대기) */
  useEffect(() => {
    if (!hashChecked || !orderId || !partner?.id || !client?.id) return;
    if (cgTid) return;
    if (syncPollStarted.current) return;
    syncPollStarted.current = true;

    let cancelled = false;
    let attempts = 0;
    setState("loading");

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const data = await fetchSyncStatus();
        if (cancelled) return;
        console.log("[ViewPay:PGReturn] webhook 대기 폴링", {
          orderId,
          attempt: attempts,
          status: data?.status,
          success: data?.success,
          orderNo: data?.orderNo,
          message: data?.message,
          raw: data,
        });
        if (data?.success && data?.status === "paid" && data?.orderNo) {
          applyCompletePayload(data);
          return;
        }
        if (data?.status === "failed") {
          redirectToPaymentOutcome(data);
          return;
        }
      } catch {
        // 다음 폴링
      }
      if (cancelled) return;
      if (attempts < SYNC_STATUS_MAX_POLLS) {
        window.setTimeout(poll, SYNC_STATUS_POLL_MS);
        return;
      }
      redirectToPaymentOutcome(
        { outcome: "system_error", code: "TIMEOUT" },
        "결제 확인에 시간이 걸리고 있습니다. 잠시 후 주문 조회에서 상태를 확인해 주세요."
      );
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [hashChecked, orderId, cgTid, partner?.id, client?.id, guestToken, guestSig]);

  const handleContinueShopping = () => {
    router.push(`/${subdomain}/${clientSlug}`);
  };
  const handleOrderList = () => {
    router.push(`/${subdomain}/${clientSlug}/mypage/orders`);
  };
  const handleGuestOrderLookupShortcut = (orderNoValue: string, ordererNameValue: string) => {
    const orderNoSafe = orderNoValue.trim();
    if (!orderNoSafe || orderNoSafe === "—") return;
    const qs = new URLSearchParams({
      tab: "guest",
      clientSlug,
      orderNo: orderNoSafe,
    });
    const ordererSafe = ordererNameValue.trim();
    if (ordererSafe) {
      qs.set("ordererName", ordererSafe);
    }
    router.push(`/${subdomain}/login?${qs.toString()}`);
  };

  const formatOption = (optionJson: Record<string, string> | null): string => {
    if (!optionJson || typeof optionJson !== "object") return "";
    return Object.entries(optionJson)
      .map(([k, v]) => (v ? `${k}: ${v}` : k))
      .filter(Boolean)
      .join(" / ");
  };

  const handleCopyOrderNo = async (raw: string) => {
    const text = raw.trim();
    if (!text || text === "—") return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast("주문번호를 복사했습니다.", "success");
    } catch {
      toast("복사에 실패했습니다. 주문번호를 직접 선택해 복사해 주세요.", "error");
    }
  };

  const content = () => {
    if (state === "loading" || state === "redirecting" || (state === "idle" && orderId && cgTid)) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D6A8E0] border-t-transparent" />
          <p className="text-[#6B7280]">{/* 결제 완료 확인 중... */}</p>
        </div>
      );
    }

    if (state === "success" && orderNo) {
      const order = orderDetail?.order;
      const items = orderDetail?.items ?? [];
      const itemsTotal = items.reduce((sum, i) => sum + Number(i.total_price), 0);
      const shippingFee = order
        ? Math.max(0, Number(order.total_amount) - itemsTotal)
        : 0;
      const receiverLine = order
        ? `${order.shipping_name || "—"} (${order.shipping_phone || "—"})`
        : "—";
      const streetAddress = order
        ? formatFloristShippingAddressForCustomerUI(
            order.shipping_address,
            order.shipping_detail
          )
        : "";
      const ribbonMsg = order?.ribbon_message?.trim() ?? "";
      const ribbonFrom = order?.ribbon_sender?.trim() ?? "";
      const deliveryHope = order
        ? formatDeliveryHopeLine(
            order.desired_delivery_date,
            order.delivery_time_slot
          )
        : "—";

      const orderNoDisplay =
        order?.order_no?.trim() || orderNo || "—";
      const displayStoreName =
        order?.client?.name ?? client?.name ?? "쇼핑몰";
      const footerCopyrightOwner =
        order?.client?.name?.trim() ||
        client?.name?.trim() ||
        partner?.company_name?.trim() ||
        "쇼핑몰";
      const lookupOrdererName =
        order?.orderer_name?.trim() || order?.shipping_name?.trim() || "";

      return (
        <div className="break-keep [word-break:keep-all]">
          {/* ① 상단: 아이콘 → 타이틀 → 서브 → 주문번호 필 */}
          <div className="flex flex-col items-center px-4 pb-2 pt-6">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-2 ring-emerald-400/80"
              aria-hidden
            >
              <CircleCheck
                className="h-8 w-8 text-emerald-600"
                strokeWidth={2.25}
              />
            </div>
            <h1 className="mt-6 px-2 text-center text-xl font-bold leading-snug tracking-tight text-gray-900 sm:text-[1.35rem]">
              주문이 정상적으로 완료되었습니다.
            </h1>
            <p className="mt-3 max-w-[22rem] px-2 text-center text-sm leading-relaxed text-gray-500">
              마음을 담아 안전하고 정확하게 배송해 드리겠습니다.
            </p>
            <div className="mt-7 flex justify-center px-4">
              <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 py-2 pl-5 pr-1.5 shadow-sm">
                <p className="min-w-0 flex-1 text-center text-[0.7rem] leading-snug tracking-wide text-gray-500">
                  ORDER NO.{" "}
                  <span
                    className="text-sm font-bold text-gray-900 break-all sm:break-keep"
                    title={orderNoDisplay}
                  >
                    {orderNoDisplay}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => void handleCopyOrderNo(orderNoDisplay)}
                  disabled={!orderNoDisplay || orderNoDisplay === "—"}
                  className="flex shrink-0 rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-200/90 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="주문번호 복사"
                  title="주문번호 복사"
                >
                  <Copy className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>
            {guestToken && guestSig ? (
              <div className="mt-6 w-full max-w-[22rem] rounded-xl border border-purple-100 bg-purple-50 p-5">
                <p className="mb-3 text-center text-sm leading-relaxed text-purple-800" role="note">
                  비회원 주문 조회를 위해
                  <br />
                  <span className="font-bold">주문번호를 꼭 기억해주세요.</span>
                </p>
                <button
                  type="button"
                  onClick={() =>
                    handleGuestOrderLookupShortcut(orderNoDisplay, lookupOrdererName)
                  }
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-purple-200 bg-white py-2.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                >
                  주문 조회 화면으로 이동
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>

          {/* ② 주문 상품 카드 (이전 스타일) */}
          <div className={`${whiteCardClass} mx-4 mt-6 rounded-xl p-5`}>
            <p className="text-sm font-medium text-[#6B7280]">{displayStoreName}</p>
            {orderDetailLoading && items.length === 0 ? (
              <div className="mt-3 flex gap-3">
                <div className="h-20 w-20 shrink-0 animate-pulse rounded-lg bg-gray-200" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-1/4 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ) : (
              <>
                {items.map((item) => (
                  <div key={item.id} className="mt-3 flex gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-200">
                      {item.product?.thumbnail_url ? (
                        <img
                          src={item.product.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#333333]">
                        {item.product?.name ?? item.product_name}
                      </p>
                      <p className="mt-0.5 text-sm text-[#6B7280] break-keep [word-break:keep-all]">
                        {formatOption(item.option_json)}
                        {item.quantity > 1 ? ` / ${item.quantity}개` : ""}
                      </p>
                      <span className="mt-1.5 inline-block rounded-full border border-emerald-500 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        결제완료
                      </span>
                      <p className="mt-2 font-semibold text-[#333333]">
                        {Number(item.total_price).toLocaleString()}원
                      </p>
                    </div>
                  </div>
                ))}
                <div className="mt-4 border-t border-gray-100 pt-4">
                  {shippingFee <= 0 ? (
                    <p className="text-sm">
                      <span className="font-medium text-[#6B7280]">배송비</span>
                      <span className="ml-2 font-semibold text-violet-700/85">
                        무료배송
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-[#6B7280]">
                      배송비 {shippingFee.toLocaleString()}원
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ③ 배송 및 제작 정보 */}
          <div className={`${whiteCardClass} mx-4 mt-4 rounded-2xl p-5`}>
            <div className="mb-5 flex items-center gap-2">
              <span
                className="h-5 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: PRIMARY }}
                aria-hidden
              />
              <h2 className="text-base font-bold text-gray-900">
                배송 및 제작 정보
              </h2>
            </div>
            {orderDetailLoading && !order ? (
              <div className="space-y-4">
                <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
                <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
                <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <DeliveryInfoRow
                  icon={Calendar}
                  label="배송 희망일"
                  valueBold
                >
                  {deliveryHope}
                </DeliveryInfoRow>
                <DeliveryInfoRow icon={User} label="수령인(받는 분)">
                  {receiverLine}
                </DeliveryInfoRow>
                <DeliveryInfoRow icon={MapPin} label="배송 주소">
                  {streetAddress || "—"}
                </DeliveryInfoRow>
                <DeliveryInfoRow
                  icon={MessageCircle}
                  label="리본 메시지"
                  valueBold
                >
                  {ribbonMsg ? (
                    <span>&ldquo;{ribbonMsg}&rdquo;</span>
                  ) : (
                    "—"
                  )}
                </DeliveryInfoRow>
                <DeliveryInfoRow icon={UserPlus} label="리본 보내는 분">
                  {ribbonFrom || "—"}
                </DeliveryInfoRow>
              </div>
            )}
          </div>

          {/* ④ 하단 버튼 — 주문서(checkout) 결제 버튼 톤, 1행 2열 */}
          <div className="mx-4 mt-6 flex gap-3 pb-3 pt-1">
            <button
              type="button"
              onClick={handleContinueShopping}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold text-white transition-opacity hover:opacity-95 active:opacity-90 sm:text-base"
              style={{ backgroundColor: PRIMARY }}
            >
              <ShoppingBag className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              쇼핑 계속하기
            </button>
            <button
              type="button"
              onClick={handleOrderList}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 bg-white py-4 text-sm font-bold transition-colors hover:bg-[#F3E8F5]/50 sm:text-base"
              style={{ borderColor: PRIMARY, color: PRIMARY }}
            >
              <List className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              주문 내역
            </button>
          </div>
          <footer className="mt-4 flex flex-col items-center justify-center border-t border-gray-100 pb-6 pt-5 text-center">
            <p className="mb-1 text-lg font-bold text-gray-800">고객센터 1661-1897</p>
            <p className="mb-4 text-xs text-gray-500">운영시간 : 평일 08:30 ~ 19:00</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">
              Copyright © {footerCopyrightOwner}. All rights reserved.
            </p>
          </footer>
        </div>
      );
    }


    if (!orderId) {
      return (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-center text-[#6B7280]">잘못된 접근입니다.</p>
          <button
            type="button"
            onClick={handleContinueShopping}
            className="rounded-xl px-6 py-2 font-medium text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            쇼핑몰 홈으로
          </button>
        </div>
      );
    }

    return null;
  };

  // [2] 최하단 return: 회색 배경만 감싸고, 하얀 카드는 상태별로 content() 내부에서만 사용
  const isSuccess = state === "success" && orderNo;
  const needsSingleCard =
    state === "loading" ||
    state === "redirecting" ||
    (state === "idle" && orderId && cgTid) ||
    !orderId;

  return (
    <OrderGuard
      partnerId={partner?.id ?? undefined}
      shopClientId={client?.id}
      shopClientName={client?.name ?? undefined}
      requireAuth={false}
      blockAffiliationMismatch={false}
    >
      <div
        className="min-h-[60vh] w-full"
        style={{
          backgroundColor: BG_PAGE,
          paddingBottom: `calc(24px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        {isSuccess ? (
          <div className="mx-auto max-w-md flex flex-col gap-4">
            {content()}
          </div>
        ) : needsSingleCard ? (
          <div className="px-4 pt-4">
            <div className={whiteCardClass}>{content()}</div>
          </div>
        ) : (
          <div className="px-4 pt-4">{content()}</div>
        )}
      </div>
    </OrderGuard>
  );
}

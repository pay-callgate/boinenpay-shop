"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  CircleCheck,
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
/** 스냅샷: 최종 결제 금액 등 강조 보라 */
const ACCENT_PURPLE = "#9333EA";
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

type CompleteState = "idle" | "loading" | "success" | "error" | "no_payment_id";

const whiteCardClass = "mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-sm";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<{
    order: OrderDetailOrder;
    items: OrderItemRow[];
  } | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);

  const guestSyncStarted = useRef(false);

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
      setState("error");
      setErrorMessage((data?.message as string) ?? "결제 완료 처리에 실패했습니다.");
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
      .then((data) => {
        if (cancelled) return;
        applyCompletePayload(data as Record<string, unknown>);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message ?? "결제 완료 확인 중 오류가 발생했습니다.";
        setState("error");
        setErrorMessage(msg);
        toast(msg, "error");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, cgTid, partner?.id, client?.id, guestOrderQs]);

  /** ViewPay가 returnUrl에 cgTid를 안 붙인 비회원 건: 서버에서 가맹점 주문번호로 조회·반영 */
  useEffect(() => {
    if (!hashChecked || !orderId || !partner?.id || !client?.id) return;
    if (cgTid) return;
    if (guestToken && guestSig) {
      if (guestSyncStarted.current) return;
      guestSyncStarted.current = true;
      let cancelled = false;
      setState("loading");
      shopFetch("/api/payment/viewpay/guest-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          guestToken,
          paymentSignature: guestSig,
        }),
        handleSessionExpiry: false,
      })
        .then((res) => res.json().catch(() => ({})))
        .then((data) => {
          if (cancelled) return;
          if (data?.success && data?.orderNo) {
            applyCompletePayload(data as Record<string, unknown>);
          } else {
            setState("no_payment_id");
            setErrorMessage(
              (data?.message as string) ||
                "결제가 완료되었을 수 있습니다. 주문 내역에서 결제 상태를 확인해 주세요."
            );
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setState("no_payment_id");
          setErrorMessage(
            err?.message ||
              "결제가 완료되었을 수 있습니다. 주문 내역에서 결제 상태를 확인해 주세요."
          );
        });
      return () => {
        cancelled = true;
      };
    }
    setState("no_payment_id");
    setErrorMessage(
      "결제가 완료되었을 수 있습니다. 주문 내역에서 결제 상태를 확인해 주세요."
    );
  }, [hashChecked, orderId, cgTid, guestToken, guestSig, partner?.id, client?.id]);

  const handleContinueShopping = () => {
    router.push(`/${subdomain}/${clientSlug}`);
  };
  const handleOrderList = () => {
    router.push(`/${subdomain}/${clientSlug}/mypage/orders`);
  };

  const formatOption = (optionJson: Record<string, string> | null): string => {
    if (!optionJson || typeof optionJson !== "object") return "";
    return Object.entries(optionJson)
      .map(([k, v]) => (v ? `${k}: ${v}` : k))
      .filter(Boolean)
      .join(" / ");
  };

  const content = () => {
    if (state === "loading" || (state === "idle" && orderId && cgTid)) {
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
        ? [order.shipping_address, order.shipping_detail].filter(Boolean).join(" ")
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
      const finalPaymentAmount = order
        ? Number(order.total_amount)
        : items.reduce((s, i) => s + Number(i.total_price), 0);

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
            <div className="mt-7 rounded-full bg-gray-100 px-6 py-2.5">
              <p className="text-center text-[0.7rem] tracking-wide text-gray-500">
                ORDER NO.{" "}
                <span className="text-sm font-bold text-gray-900">
                  {orderNoDisplay}
                </span>
              </p>
            </div>
          </div>

          {/* ② 주문 상품 카드 */}
          <div className={`${whiteCardClass} mx-4 mt-6 rounded-2xl p-5`}>
            <h2 className="text-base font-bold text-gray-900">주문 상품</h2>
            {orderDetailLoading && items.length === 0 ? (
              <div className="mt-4 flex gap-3">
                <div className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-gray-200" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                  <div className="h-6 w-24 animate-pulse rounded-full bg-gray-100" />
                </div>
              </div>
            ) : (
              <>
                {items.map((item, idx) => {
                  const optionLine = formatOption(item.option_json);
                  return (
                    <div
                      key={item.id}
                      className={idx > 0 ? "mt-5 border-t border-gray-100 pt-5" : "mt-4"}
                    >
                      <div className="flex gap-3">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                          {item.product?.thumbnail_url ? (
                            <img
                              src={item.product.thumbnail_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900">
                            {item.product?.name ?? item.product_name}
                          </p>
                          {optionLine ? (
                            <p className="mt-1 text-xs leading-relaxed text-gray-500">
                              {optionLine}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {shippingFee <= 0 && idx === 0 ? (
                              <span className="rounded-full bg-teal-500 px-2.5 py-1 text-xs font-semibold text-white">
                                무료배송
                              </span>
                            ) : null}
                            {shippingFee > 0 && idx === 0 ? (
                              <span className="text-xs font-medium text-gray-600">
                                배송비 {shippingFee.toLocaleString()}원
                              </span>
                            ) : null}
                            <span className="text-sm font-medium text-gray-900">
                              {item.quantity}개
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="my-5 border-t border-dashed border-gray-200" />
                <div className="flex items-end justify-between gap-3">
                  <span className="pb-0.5 text-sm text-gray-500">
                    최종 결제 금액
                  </span>
                  {orderDetailLoading && !order ? (
                    <div className="h-8 w-28 animate-pulse rounded bg-gray-100" />
                  ) : (
                    <span
                      className="text-xl font-bold tabular-nums"
                      style={{ color: ACCENT_PURPLE }}
                    >
                      {finalPaymentAmount.toLocaleString("ko-KR")}원
                    </span>
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

          {/* ④ 하단 버튼 (가로 2열 · 스냅샷) */}
          <div className="mx-4 mt-6 pb-10 pt-1">
            <div
              className="mb-5 flex justify-center gap-1.5"
              aria-hidden
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-gray-300"
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleContinueShopping}
                className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold shadow-sm transition hover:brightness-[0.98] active:brightness-95"
                style={{
                  backgroundColor: PRIMARY_LIGHT,
                  color: "#7C3AED",
                }}
              >
                <ShoppingBag className="h-5 w-5 shrink-0" strokeWidth={2} />
                쇼핑 계속하기
              </button>
              <button
                type="button"
                onClick={handleOrderList}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-gray-300 bg-white py-3.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                <List className="h-5 w-5 shrink-0 text-gray-600" strokeWidth={2} />
                주문 내역
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (state === "error" || state === "no_payment_id") {
      return (
        <div className="flex flex-col items-center gap-6 py-8">
          <p className="text-center font-medium text-[#333333]">
            {errorMessage ?? "결제 완료 처리 중 문제가 발생했습니다."}
          </p>
          <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
            <button
              type="button"
              onClick={handleOrderList}
              className="w-full rounded-xl py-3.5 font-medium text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              주문 내역
            </button>
            <button
              type="button"
              onClick={handleContinueShopping}
              className="w-full rounded-xl border py-3.5 font-medium"
              style={{ borderColor: PRIMARY, color: PRIMARY }}
            >
              쇼핑 계속하기
            </button>
          </div>
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
    (state === "idle" && orderId && cgTid) ||
    state === "error" ||
    state === "no_payment_id" ||
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

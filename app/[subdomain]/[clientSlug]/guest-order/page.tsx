"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { BOTTOM_NAV_HEIGHT, HEADER_HEIGHT } from "@/components/shop/ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";
import { effectiveGuestUnitPrice } from "@/lib/product-pricing";
import { openDaumPostcode } from "@/lib/daum-postcode";
import { assignLocationHrefForPayment } from "@/lib/kakao-in-app-browser";
import { useViewpayCheckoutGuard } from "@/lib/use-viewpay-checkout-guard";
import {
  CheckoutOrderGuideEmpty,
  CheckoutOrderGuideLoading,
  CheckoutOrderGuidePending,
} from "@/components/shop/CheckoutOrderGuidePanel";
import { runViewpayPreparePayment } from "@/lib/run-viewpay-prepare";
import { isShopPaymentTunnelPath } from "@/lib/shop-payment-tunnel";
import { checkoutFieldFocusScroll, checkoutInputEnterGoNext } from "@/lib/checkout-form-ux";
import { RibbonMessageSection } from "@/components/shop/RibbonMessageSection";
import { CheckoutPaymentMethodSegment } from "@/components/shop/CheckoutPaymentMethodSegment";
import {
  TIME_SLOTS,
  digitsOnlyPhone,
  buildFloristShippingDetailText,
  resolveRibbonPhrase,
} from "@/lib/checkout-florist-fields";
import {
  alertRibbonSectionPayValidation,
  validateRibbonSectionBeforePayment,
} from "@/lib/ribbon-checkout-validation";
import {
  deriveRibbonRuleKindFromCartItems,
  isRibbonCombinedMessageUiFromCartItems,
} from "@/lib/ribbon-default-by-category";
import { useRibbonPresetFromCart } from "@/lib/use-ribbon-preset-from-cart";
import type { ShopProductCategoryRef } from "@/lib/shop-product-categories";
import {
  getSeoulTodayYmd,
  getSeoulTomorrowYmd,
  isDeliveryDateInPast,
} from "@/lib/shop-delivery-date";

/**
 * 비회원 전용 주문서 — 화환/꽃배달(우리부고) 입력 구성
 * /{subdomain}/{clientSlug}/guest-order?items=cartItemId[,...]
 */

const PRIMARY = "#D6A8E0";
const PRIMARY_LIGHT = "#F3E8F5";
const TEXT = "#333333";
const TEXT_MUTED = "#6B7280";
const BORDER = "#E5E7EB";
// 배송 방식 UI 제거 — 이전 옵션별 배송비 (복구 시 참고)
// const DELIVERY_OPTIONS = [
//   { value: "parcel", label: "택배 배송", fee: 4000 },
//   { value: "quick", label: "퀵배송", fee: 5000 },
//   { value: "store_pickup", label: "스토어픽업", fee: 1000 },
// ] as const;

interface CartItem {
  id: string;
  product_id: string;
  option_json: Record<string, string> | null;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnail_url: string | null;
    base_price: number;
    sale_price: number | null;
    member_price?: number | null;
    status: string;
    product_category_mappings?: { category: ShopProductCategoryRef | null }[];
  };
}

/** POST /api/orders 성공 후 ViewPay prepare 실패 시, 재클릭에서 prepare만 재시도하기 위한 스냅샷 */
type PendingOrderPrepareSnapshot = {
  orderNo: string;
  totalAmount: number;
  guestCheckoutToken?: string;
  paymentSignature?: string;
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-4 py-3.5 text-sm outline-none transition-colors focus:border-[#D6A8E0] focus:ring-1 focus:ring-[#D6A8E0]/30";
const labelClass = "mb-2 block text-xs font-semibold tracking-tight";
const sectionCardClass = "overflow-hidden rounded-xl border border-gray-200 bg-gray-50/90 p-5";
const CHECKOUT_STICKY_FOOTER_HEIGHT = 136;

function checkoutTunnelMinHeight() {
  return `calc(var(--shop-viewport-height, 100svh) - ${HEADER_HEIGHT}px)`;
}

function checkoutStickyBottom(stickyAboveNav: number) {
  return `calc(var(--shop-visual-viewport-bottom, 0px) + ${stickyAboveNav}px)`;
}

function checkoutBodyPaddingBottom(stickyAboveNav: number) {
  return `calc(${CHECKOUT_STICKY_FOOTER_HEIGHT}px + var(--shop-visual-viewport-bottom, 0px) + env(safe-area-inset-bottom, 0px) + ${stickyAboveNav}px)`;
}

export default function GuestOrderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const pathname = usePathname();
  const stickyAboveNav = isShopPaymentTunnelPath(pathname) ? 0 : BOTTOM_NAV_HEIGHT;
  const itemsQuery = searchParams?.get("items") ?? "";
  const selectedItemIds = useMemo(
    () => (itemsQuery ? itemsQuery.split(",").filter(Boolean) : []),
    [itemsQuery]
  );

  const template = useShopTemplate();
  const partnerId = template?.partner?.id ?? null;
  const clientId = template?.client?.id ?? null;

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [ordererName, setOrdererName] = useState("");
  const [ordererPhone, setOrdererPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestPasswordConfirm, setGuestPasswordConfirm] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const minDeliveryDateYmd = useMemo(() => getSeoulTodayYmd(), []);
  const [deliveryDate, setDeliveryDate] = useState(() => getSeoulTomorrowYmd());
  const DEFAULT_TIME_SLOT = "14:00~16:00";
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState(DEFAULT_TIME_SLOT);
  const [openTimeAccordion, setOpenTimeAccordion] = useState(false);
  const [shippingPostcode, setShippingPostcode] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [venueDetail, setVenueDetail] = useState("");

  const [ribbonSender, setRibbonSender] = useState("");
  const {
    ribbonPreset,
    setRibbonPreset,
    ribbonMessageCustom,
    setRibbonMessageCustom,
  } = useRibbonPresetFromCart(items);
  const ribbonFieldsRequired = useMemo(() => {
    const kind = deriveRibbonRuleKindFromCartItems(items);
    return kind === "condolence" || kind === "celebration";
  }, [items]);
  const combinedRibbonAndCard = useMemo(
    () => isRibbonCombinedMessageUiFromCartItems(items),
    [items]
  );
  const [ribbonCardExtra, setRibbonCardExtra] = useState("");

  /** 배송 방식 선택 UI 제거 — API/주문 레코드 호환용 기본값 */
  const deliveryMethod = "parcel" as const;
  // const deliveryFee = DELIVERY_OPTIONS.find((o) => o.value === deliveryMethod)?.fee ?? 4000;
  const deliveryFee = 0;

  const [paymentMethod, setPaymentMethod] = useState("card");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** 주문 생성 성공 후 결제창만 실패한 경우 재시도용 (페이지 이탈 시 컴포넌트 언마운트로 함께 초기화) */
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingPrepareSnapshot, setPendingPrepareSnapshot] =
    useState<PendingOrderPrepareSnapshot | null>(null);
  const [guardResumeLoading, setGuardResumeLoading] = useState(false);

  const checkoutGuard = useViewpayCheckoutGuard({
    clientId,
    subdomain,
    clientSlug,
    cartLoading: loading,
    cartItemCount: items.length,
    pendingOrderId,
  });

  /**
   * 로그인 회원이 /guest-order URL로 직접 들어온 경우:
   * 게스트 장바구니 행 ID를 그대로 checkout에 넘기면 회원 장바구니와 불일치해 빈 주문서가 된다.
   * 게스트 카트에서 같은 상품/옵션/수량을 회원 장바구니에 담은 뒤 checkout으로 보낸다.
   */
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !clientId || !partnerId) return;
    let cancelled = false;

    (async () => {
      toast("이미 로그인되어 있어 회원 결제 페이지로 이동합니다.", "success");
      const q = itemsQuery.trim();

      if (!q) {
        if (!cancelled) router.replace(`/${subdomain}/${clientSlug}/checkout`);
        return;
      }

      try {
        const guestRes = await shopFetch(
          `/api/cart?clientId=${encodeURIComponent(clientId)}&guestCart=1`
        );
        if (!guestRes.ok || cancelled) {
          if (!cancelled) router.replace(`/${subdomain}/${clientSlug}/checkout`);
          return;
        }
        const guestData = await guestRes.json();
        const all = (guestData.items || []) as CartItem[];
        const selected =
          selectedItemIds.length > 0
            ? all.filter((item) => selectedItemIds.includes(item.id))
            : all;
        if (selected.length === 0) {
          if (!cancelled) router.replace(`/${subdomain}/${clientSlug}/checkout`);
          return;
        }

        const newIds: string[] = [];
        for (const item of selected) {
          const res = await shopFetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId,
              productId: item.product_id,
              optionJson: item.option_json,
              quantity: item.quantity,
            }),
          });
          if (!res.ok || cancelled) {
            if (!cancelled) {
              toast(
                "회원 장바구니로 옮기지 못했습니다. 장바구니를 확인해 주세요.",
                "error"
              );
              router.replace(`/${subdomain}/${clientSlug}/cart`);
            }
            return;
          }
          const data = await res.json();
          const id = data?.cartItem?.id as string | undefined;
          if (id) newIds.push(id);
        }
        if (cancelled) return;
        if (newIds.length === 0) {
          router.replace(`/${subdomain}/${clientSlug}/checkout`);
          return;
        }
        router.replace(
          `/${subdomain}/${clientSlug}/checkout?items=${encodeURIComponent(newIds.join(","))}`
        );
      } catch {
        if (!cancelled) router.replace(`/${subdomain}/${clientSlug}/checkout`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    sessionStatus,
    clientId,
    partnerId,
    itemsQuery,
    subdomain,
    clientSlug,
    router,
    selectedItemIds,
  ]);

  useEffect(() => {
    async function loadCart() {
      if (!clientId) {
        setLoading(false);
        return;
      }
      if (sessionStatus === "loading") return;

      setLoading(true);
      const res = await shopFetch(`/api/cart?clientId=${clientId}&guestCart=1`);
      if (res.ok) {
        const data = await res.json();
        const all = (data.items || []) as CartItem[];
        const filtered =
          selectedItemIds.length > 0
            ? all.filter((item) => selectedItemIds.includes(item.id))
            : all;
        setItems(filtered);
      } else {
        setItems([]);
      }
      setLoading(false);
    }
    loadCart();
  }, [clientId, selectedItemIds, sessionStatus]);

  useEffect(() => {
    const cancel = searchParams?.get("cancel");
    if (cancel === "1") {
      toast("결제가 취소되었습니다. 아래에서 다시 결제를 시도해 주세요.", "error");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("cancel");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
  }, [searchParams]);

  const formatPrice = (price: number) => new Intl.NumberFormat("ko-KR").format(price);

  const getItemUnit = (item: CartItem) =>
    effectiveGuestUnitPrice({
      base_price: item.product.base_price,
      sale_price: item.product.sale_price,
      member_price: item.product.member_price ?? null,
    });
  const getItemPrice = (item: CartItem) => getItemUnit(item) * item.quantity;
  const getTotalProductPrice = () => items.reduce((sum, item) => sum + getItemPrice(item), 0);
  const finalTotal = getTotalProductPrice();
  const displayPayTotal =
    items.length > 0
      ? finalTotal
      : pendingPrepareSnapshot?.totalAmount ?? finalTotal;
  // + deliveryFee (배송비 계산 비활성화)

  const resolvedRibbonMessage = resolveRibbonPhrase(ribbonPreset, ribbonMessageCustom);

  const openPostcodeSearch = () => {
    openDaumPostcode(({ zonecode, address }) => {
      setShippingPostcode(zonecode);
      setShippingAddress(address);
      setVenueDetail("");
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privacyAgreed) {
      toast("개인정보 수집 및 이용에 동의해 주세요.");
      return;
    }
    if (paymentMethod !== "card") {
      toast("현재 신용카드 결제만 가능합니다. 무통장 입금은 추후 지원 예정입니다.");
      return;
    }
    if (!template?.orderAllowed) {
      toast("마스터 템플릿 미리보기 상태에서는 주문이 불가능합니다.");
      return;
    }
    if (!partnerId || !clientId) {
      toast("주문 정보가 올바르지 않습니다.");
      return;
    }
    if (!pendingOrderId && items.length === 0) {
      toast("주문 정보가 올바르지 않습니다.");
      return;
    }
    const on = ordererName.trim();
    const op = digitsOnlyPhone(ordererPhone);
    const pw = guestPassword.trim();
    const em = guestEmail.trim();
    if (!on || !op) {
      toast("주문자 성명과 연락처를 입력해 주세요.");
      return;
    }
    if (op.length < 8) {
      toast("주문자 연락처를 올바르게 입력해 주세요.");
      return;
    }
    if (pw.length < 4) {
      toast("주문 조회용 비밀번호는 4자 이상 입력해 주세요.");
      return;
    }
    if (pw !== guestPasswordConfirm.trim()) {
      toast("주문 조회 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast("이메일 형식을 확인해 주세요.");
      return;
    }
    const rn = recipientName.trim();
    const rp = digitsOnlyPhone(recipientPhone);
    if (!rn || !rp) {
      toast("수령인 성명과 연락처를 입력해 주세요.");
      return;
    }
    if (isDeliveryDateInPast(deliveryDate)) {
      toast("배달 일시는 과거 날짜를 선택할 수 없습니다.");
      return;
    }
    if (!shippingAddress.trim()) {
      toast("배달지 주소를 입력해 주세요. 우편번호 찾기를 이용해 주세요.");
      return;
    }
    if (
      !validateRibbonSectionBeforePayment({
        items,
        ribbonPreset,
        ribbonSender,
        ribbonMessageCustom,
      })
    ) {
      alertRibbonSectionPayValidation();
      return;
    }

    const shippingDetail = buildFloristShippingDetailText({
      venueDetail,
      deliveryDate,
      deliveryTimeSlot,
      ordererName: on,
      ordererPhone: op,
      ribbonSender,
      ribbonMessage: resolvedRibbonMessage,
      ribbonCardMessage: combinedRibbonAndCard
        ? undefined
        : ribbonCardExtra.trim() || undefined,
    });

    setSubmitting(true);

    const runViewPayPrepare = async (order: {
      id: string;
      order_no: string;
      total_amount: number;
      guestTok?: string;
      paySig?: string;
    }): Promise<boolean> => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      let returnUrl = `${origin}/${subdomain}/${clientSlug}/order/complete?orderId=${order.id}`;
      if (order.guestTok && order.paySig) {
        returnUrl += `&guestToken=${encodeURIComponent(order.guestTok)}&sig=${encodeURIComponent(order.paySig)}`;
      }
      const cancelUrl = `${origin}/${subdomain}/${clientSlug}/guest-order?cancel=1&items=${encodeURIComponent(itemsQuery)}`;
      const productName =
        items.length > 0 ? items[0].product?.name ?? "주문상품" : "주문상품";
      const prepareBody: Record<string, unknown> = {
        orderId: order.id,
        orderNo: order.order_no,
        amount: order.total_amount,
        productName,
        returnUrl,
        cancelUrl,
        buyerName: on,
        buyerPhone: op,
        buyerEmail: em,
      };
      if (order.guestTok && order.paySig) {
        prepareBody.guestCheckoutToken = order.guestTok;
        prepareBody.paymentSignature = order.paySig;
      }
      const prepareRes = await shopFetch("/api/payment/viewpay/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepareBody),
      });
      const prepareData = await prepareRes.json().catch(() => ({}));
      if (prepareRes.ok && prepareData.success && prepareData.redirectUrl) {
        assignLocationHrefForPayment(String(prepareData.redirectUrl));
        return true;
      }
      toast(
        (prepareData as { message?: string }).message ||
          "결제창을 열 수 없습니다. 아래에서 결제하기를 다시 눌러 주세요.",
        "error"
      );
      return false;
    };

    try {
      if (pendingOrderId && pendingPrepareSnapshot) {
        toast("안전한 결제창으로 이동합니다.", "default");
        await runViewPayPrepare({
          id: pendingOrderId,
          order_no: pendingPrepareSnapshot.orderNo,
          total_amount: pendingPrepareSnapshot.totalAmount,
          guestTok: pendingPrepareSnapshot.guestCheckoutToken,
          paySig: pendingPrepareSnapshot.paymentSignature,
        });
        return;
      }

      const orderPayload: Record<string, unknown> = {
        partnerId,
        clientId,
        cartItemIds: items.map((i) => i.id),
        shippingName: rn,
        shippingPhone: rp,
        shippingPostcode: shippingPostcode.trim() || "00000",
        shippingAddress: shippingAddress.trim(),
        shippingDetail,
        detailPlace: venueDetail.trim(),
        deliveryDate: deliveryDate || null,
        deliveryTimeSlot: deliveryTimeSlot || DEFAULT_TIME_SLOT,
        deliveryMethod,
        deliveryFee,
        ordererName: on,
        ribbonSender: ribbonSender.trim(),
        ribbonMessage: resolvedRibbonMessage,
        ribbonCardMessage: combinedRibbonAndCard
          ? undefined
          : ribbonCardExtra.trim() || undefined,
        paymentMethod,
        isGuest: true,
        guestPassword: pw,
        ...(em ? { guestOrdererEmail: em } : {}),
      };

      const res = await shopFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = typeof (err as { details?: string }).details === "string" ? (err as { details: string }).details : "";
        toast(
          detail
            ? `${(err as { error?: string }).error || "주문에 실패했습니다."} (${detail})`
            : (err as { error?: string }).error || "주문에 실패했습니다.",
          "error"
        );
        return;
      }
      const data = await res.json();
      const order = data.order as { id: string; order_no: string; total_amount: number };
      const guestTok = data.guestCheckoutToken as string | undefined;
      const paySig = data.paymentSignature as string | undefined;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cart-updated"));
      }

      toast("안전한 결제창으로 이동합니다.", "default");
      const redirected = await runViewPayPrepare({
        id: order.id,
        order_no: order.order_no,
        total_amount: order.total_amount,
        guestTok,
        paySig,
      });
      if (!redirected) {
        setPendingOrderId(order.id);
        setPendingPrepareSnapshot({
          orderNo: order.order_no,
          totalAmount: order.total_amount,
          guestCheckoutToken: guestTok,
          paymentSignature: paySig,
        });
      }
    } catch {
      toast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuardResumePayment = async () => {
    const order = checkoutGuard.pendingOrder;
    if (!order || guardResumeLoading) return;
    setGuardResumeLoading(true);
    toast("안전한 결제창으로 이동합니다.", "info");
    try {
      await runViewpayPreparePayment({
        subdomain,
        clientSlug,
        orderId: order.id,
        orderNo: order.orderNo,
        amount: order.totalAmount,
        buyerName: order.buyerName,
        buyerPhone: order.buyerPhone,
        buyerEmail: order.buyerEmail,
        cancelPath: "guest-order",
        itemsQuery,
        guestCheckoutToken: order.guestCheckoutToken,
        paymentSignature: order.paymentSignature,
      });
    } finally {
      setGuardResumeLoading(false);
    }
  };

  if (template == null || !partnerId || !clientId) {
    return <div className="min-h-screen" style={{ backgroundColor: "#FAFAFA" }} />;
  }

  if (sessionStatus === "loading") {
    return <div className="min-h-screen" style={{ backgroundColor: "#FAFAFA" }} />;
  }

  if (sessionStatus === "authenticated") {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center"
        style={{ backgroundColor: "#FAFAFA" }}
      >
        <p className="text-sm font-medium text-gray-800">
          이미 로그인되어 있어 회원 결제 페이지로 이동합니다.
        </p>
        <div
          className="mt-5 h-9 w-9 animate-spin rounded-full border-2 border-[#E9D5FF] border-t-[#9333EA]"
          aria-hidden
        />
      </div>
    );
  }

  const showGuestOrderForm =
    items.length > 0 || Boolean(pendingOrderId);

  if (!showGuestOrderForm) {
    const guideShell = (content: React.ReactNode) => (
      <OrderGuard
        partnerId={partnerId}
        shopClientId={clientId ?? undefined}
        shopClientName={template?.client?.name ?? undefined}
        requireAuth={false}
        blockAffiliationMismatch={false}
      >
        {content}
      </OrderGuard>
    );

    if (
      loading ||
      checkoutGuard.phase === "loading" ||
      checkoutGuard.phase === "paid_redirect"
    ) {
      return guideShell(<CheckoutOrderGuideLoading />);
    }

    if (checkoutGuard.phase === "pending" && checkoutGuard.pendingOrder) {
      return guideShell(
        <CheckoutOrderGuidePending
          order={checkoutGuard.pendingOrder}
          subdomain={subdomain}
          clientSlug={clientSlug}
          resumeLoading={guardResumeLoading}
          onResumePayment={handleGuardResumePayment}
        />
      );
    }

    return guideShell(
      <CheckoutOrderGuideEmpty subdomain={subdomain} clientSlug={clientSlug} />
    );
  }

  const paymentLineProductSum = items.length > 0 ? getTotalProductPrice() : displayPayTotal;

  const SectionDivider = () => <div className="h-2 bg-gray-100" aria-hidden />;

  return (
    <OrderGuard
      partnerId={partnerId}
      shopClientId={clientId ?? undefined}
      shopClientName={template?.client?.name ?? undefined}
      requireAuth={false}
      blockAffiliationMismatch={false}
    >
      <form
        onSubmit={handleSubmit}
        className="checkout-tunnel-form mx-auto min-h-[100svh] max-w-[430px] bg-white"
        style={{
          minHeight: checkoutTunnelMinHeight(),
          paddingBottom: checkoutBodyPaddingBottom(stickyAboveNav),
        }}
      >
        <div className="px-4 py-5">
          {pendingOrderId && pendingPrepareSnapshot && (
            <div
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
              role="status"
            >
              결제창을 불러오지 못했습니다. 주문번호 {pendingPrepareSnapshot.orderNo}. 아래{" "}
              <strong>결제하기</strong>를 다시 눌러 주세요.
            </div>
          )}
          <header className="mb-5">
            <p className="text-xl font-bold tracking-tight sm:text-2xl" style={{ color: PRIMARY }}>
              비회원 주문
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
              화환·꽃 배달 주문을 위해 정보를 입력해 주세요.
            </p>
          </header>

          <SectionDivider />

          {/* 1. 주문상품 */}
          <section className={sectionCardClass}>
            <h2 className="mb-4 text-base font-bold" style={{ color: TEXT }}>
              1. 주문상품
            </h2>
            <ul className="space-y-2">
              {items.length === 0 && pendingPrepareSnapshot ? (
                <li
                  className="rounded-lg border border-gray-200 bg-white p-3 text-sm"
                  style={{ color: TEXT_MUTED }}
                >
                  장바구니는 비어 있지만, 접수된 주문 금액({formatPrice(displayPayTotal)}원)으로 결제를
                  이어갈 수 있습니다.
                </li>
              ) : null}
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-2.5 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-20 sm:w-20">
                    {item.product.thumbnail_url ? (
                      <img
                        src={item.product.thumbnail_url}
                        alt={item.product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gray-200" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug" style={{ color: TEXT }}>
                      {item.product.name}
                    </p>
                    <p className="mt-1 text-xs sm:text-sm" style={{ color: TEXT_MUTED }}>
                      {formatPrice(getItemUnit(item))}원 × {item.quantity}개
                    </p>
                    <p className="mt-0.5 text-sm font-bold" style={{ color: TEXT }}>
                      {formatPrice(getItemPrice(item))}원
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <SectionDivider />

          {/* 2. 주문자 정보 */}
          <section className={sectionCardClass}>
            <h2 className="mb-4 text-base font-bold" style={{ color: TEXT }}>
              2. 주문자 정보
            </h2>
            <div className="flex flex-col gap-5">
              <div>
                <label className={labelClass} style={{ color: TEXT_MUTED }}>
                  주문자 성명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="ordererName"
                  inputMode="text"
                  autoComplete="name"
                  enterKeyHint="next"
                  value={ordererName}
                  onChange={(e) => setOrdererName(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className={inputClass}
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: TEXT_MUTED }}>
                  주문자 연락처 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  name="ordererPhone"
                  autoComplete="tel"
                  enterKeyHint="next"
                  value={ordererPhone}
                  onChange={(e) => setOrdererPhone(digitsOnlyPhone(e.target.value))}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className={inputClass}
                  placeholder="01012345678 (숫자만)"
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: TEXT_MUTED }}>
                  이메일 (선택)
                </label>
                <input
                  type="email"
                  name="guestEmail"
                  autoComplete="email"
                  enterKeyHint="next"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className={inputClass}
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: TEXT_MUTED }}>
                  주문조회 비밀번호 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  name="guestPassword"
                  autoComplete="new-password"
                  enterKeyHint="next"
                  value={guestPassword}
                  onChange={(e) => setGuestPassword(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className={inputClass}
                  placeholder="4자 이상 (배송 조회 시 사용)"
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: TEXT_MUTED }}>
                  주문조회 비밀번호 확인 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  name="guestPasswordConfirm"
                  autoComplete="new-password"
                  enterKeyHint="next"
                  value={guestPasswordConfirm}
                  onChange={(e) => setGuestPasswordConfirm(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className={inputClass}
                  placeholder="비밀번호 재입력"
                />
              </div>
            </div>
          </section>

          <SectionDivider />

          {/* 3. 수령인 정보 */}
          <section className={sectionCardClass}>
            <h2 className="mb-4 text-base font-bold" style={{ color: TEXT }}>
              3. 수령인 정보
            </h2>
            <div className="flex flex-col gap-5">
              <div>
                <label className={labelClass} style={{ color: TEXT_MUTED }}>
                  수령인 성명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="text"
                  enterKeyHint="next"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className={inputClass}
                  placeholder="수령인 성함"
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: TEXT_MUTED }}>
                  수령인 연락처 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  enterKeyHint="next"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(digitsOnlyPhone(e.target.value))}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className={inputClass}
                  placeholder="01012345678 (숫자만 입력해주세요.)"
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: TEXT_MUTED }}>
                  배달 일시 <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} style={{ color: PRIMARY }} aria-hidden />
                    <input
                      type="date"
                      enterKeyHint="next"
                      value={deliveryDate}
                      min={minDeliveryDateYmd}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next && isDeliveryDateInPast(next)) {
                          toast("배달 일시는 과거 날짜를 선택할 수 없습니다.");
                          setDeliveryDate(minDeliveryDateYmd);
                          return;
                        }
                        setDeliveryDate(next);
                      }}
                      onFocus={checkoutFieldFocusScroll}
                      onKeyDown={checkoutInputEnterGoNext}
                      className="min-h-[52px] min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-3 text-base"
                      style={{ color: TEXT }}
                    />
                  </div>
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setOpenTimeAccordion((v) => !v)}
                      className="flex min-h-[52px] w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <span className="text-sm" style={{ color: TEXT }}>
                        희망 시간대
                      </span>
                      <span className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
                        {deliveryTimeSlot}
                        {openTimeAccordion ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </span>
                    </button>
                    {openTimeAccordion && (
                      <div className="border-t border-gray-200 px-3 pb-3 pt-2">
                        <div className="grid grid-cols-2 gap-2">
                          {TIME_SLOTS.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => {
                                setDeliveryTimeSlot(slot);
                                setOpenTimeAccordion(false);
                              }}
                              className="rounded-lg border px-2 py-3 text-sm font-medium transition-colors"
                              style={{
                                borderColor: deliveryTimeSlot === slot ? PRIMARY : BORDER,
                                backgroundColor: deliveryTimeSlot === slot ? PRIMARY_LIGHT : "white",
                                color: deliveryTimeSlot === slot ? PRIMARY : TEXT,
                              }}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className={labelClass} style={{ color: TEXT_MUTED }}>
                  배달지 주소 <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shippingPostcode}
                    placeholder="우편번호"
                    onFocus={checkoutFieldFocusScroll}
                    className={`${inputClass} min-w-0 bg-gray-50`}
                  />
                  <button
                    type="button"
                    onClick={openPostcodeSearch}
                    className="min-h-[48px] rounded-lg border border-gray-200 bg-gray-100 px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-200"
                  >
                    우편번호 검색
                  </button>
                </div>
                <input
                  type="text"
                  enterKeyHint="next"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className={`${inputClass} mt-3`}
                  placeholder="도로명 주소"
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: TEXT_MUTED }}>
                  장소 상세 <span className="text-xs font-normal">(선택)</span>
                </label>
                <p className="mb-2 text-xs leading-snug" style={{ color: TEXT_MUTED }}>
                  <span className="block">배달 기사님이 쉽게 찾으실 수 있게 자세한 사항을 적어 주세요.</span>
                  <span className="mt-0.5 block">(빈소·예식장 호실, 층수, 홀 이름 등).</span>
                </p>
                <input
                  type="text"
                  inputMode="text"
                  enterKeyHint="done"
                  value={venueDetail}
                  onChange={(e) => setVenueDetail(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3.5 text-sm outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-300/50"
                  placeholder="예) 아산병원 장례식장 201호, 3층 그랜드홀"
                />
              </div>
            </div>
          </section>

          <SectionDivider />

          {/* 4. 리본·카드 */}
          <section className={sectionCardClass}>
            <h2 className="mb-4 text-base font-bold" style={{ color: TEXT }}>
              4. 리본·카드 메시지
            </h2>
            <RibbonMessageSection
              inputClass={inputClass}
              labelClass={labelClass}
              textColor={TEXT}
              textMutedColor={TEXT_MUTED}
              ribbonFieldsRequired={ribbonFieldsRequired}
              combinedRibbonAndCard={combinedRibbonAndCard}
              ribbonSender={ribbonSender}
              onRibbonSenderChange={setRibbonSender}
              ribbonPreset={ribbonPreset}
              onRibbonPresetChange={setRibbonPreset}
              ribbonMessageCustom={ribbonMessageCustom}
              onRibbonMessageCustomChange={setRibbonMessageCustom}
              {...(!combinedRibbonAndCard
                ? {
                    ribbonCardExtra,
                    onRibbonCardExtraChange: setRibbonCardExtra,
                  }
                : {})}
            />
          </section>

          <SectionDivider />

          <section className="py-4">
            <div className={sectionCardClass}>
              <h2 className="mb-4 text-base font-bold" style={{ color: TEXT }}>
                5. 결제 수단·금액
              </h2>
              <CheckoutPaymentMethodSegment
                paymentMethod={paymentMethod}
                onSelectCard={() => setPaymentMethod("card")}
                primaryColor={PRIMARY}
                primaryLight={PRIMARY_LIGHT}
                borderColor={BORDER}
                textColor={TEXT}
                mutedColor={TEXT_MUTED}
              />
              <div className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: TEXT_MUTED }}>상품 합계</span>
                  <span style={{ color: TEXT }}>{formatPrice(paymentLineProductSum)}원</span>
                </div>
                <div
                  className="mt-4 flex items-center justify-between gap-4 border-t pt-4"
                  style={{ borderColor: BORDER }}
                >
                  <span className="text-base font-bold" style={{ color: TEXT }}>
                    총 결제금액
                  </span>
                  <span className="shrink-0 text-2xl font-extrabold" style={{ color: TEXT }}>
                    {formatPrice(displayPayTotal)}원
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Sticky footer */}
        <div
          className="fixed left-0 right-0 z-50 mx-auto max-w-[430px] border-t bg-white px-4 pt-4 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
          style={{
            borderColor: BORDER,
            bottom: checkoutStickyBottom(stickyAboveNav),
            paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <label className="mb-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={privacyAgreed}
              onChange={(e) => setPrivacyAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#D6A8E0]"
            />
            <span className="text-xs leading-relaxed" style={{ color: TEXT_MUTED }}>
              <span className="font-semibold text-gray-800">[필수]</span> 개인정보 수집 및 이용에 동의합니다.
            </span>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl py-4 text-base font-bold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: submitting ? "#9CA3AF" : PRIMARY }}
          >
            {submitting ? "처리 중…" : `${formatPrice(displayPayTotal)}원 결제하기`}
          </button>
        </div>
      </form>
    </OrderGuard>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, Calendar, ChevronRight } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { BOTTOM_NAV_HEIGHT } from "@/components/shop/ShopLayout";
import { CheckoutStickyFooterPortal } from "@/components/shop/CheckoutStickyFooterPortal";
import { checkoutTunnelFormStyle } from "@/lib/checkout-tunnel-layout";
import { shopFetch } from "@/lib/shop-fetch";
import { useViewpayCheckoutGuard } from "@/lib/use-viewpay-checkout-guard";
import {
  CheckoutOrderGuideEmpty,
  CheckoutOrderGuideLoading,
  CheckoutOrderGuidePaidNotice,
  CheckoutOrderGuidePendingOffer,
} from "@/components/shop/CheckoutOrderGuidePanel";
import { runViewpayPreparePayment } from "@/lib/run-viewpay-prepare";
import { extractPendingOrderFormSnapshot } from "@/lib/apply-pending-order-form";
import { hasCheckoutCartMismatch } from "@/lib/checkout-cart-id-match";
import { isShopPaymentTunnelPath } from "@/lib/shop-payment-tunnel";
import { checkoutFieldFocusScroll, checkoutInputEnterGoNext } from "@/lib/checkout-form-ux";
import { toast } from "@/components/shop/ToastContext";
import { AddressSelectModal, type Address } from "@/components/shop/AddressSelectModal";
import { RibbonMessageSection } from "@/components/shop/RibbonMessageSection";
import { CheckoutPaymentMethodSegment } from "@/components/shop/CheckoutPaymentMethodSegment";
import { openDaumPostcode } from "@/lib/daum-postcode";
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
  effectiveGuestUnitPrice,
  effectiveMemberUnitPrice,
} from "@/lib/product-pricing";
import {
  getSeoulTodayYmd,
  getSeoulTomorrowYmd,
  isDeliveryDateInPast,
} from "@/lib/shop-delivery-date";

/**
 * 주문서(Checkout) - 네이버 쇼핑 결제 프로세스 99% 일치
 * /{subdomain}/{clientSlug}/checkout
 */

const PRIMARY = "#D6A8E0";
const PRIMARY_LIGHT = "#F3E8F5";
const TEXT = "#333333";
const TEXT_MUTED = "#6B7280";
const BORDER = "#E5E7EB";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-4 py-3.5 text-sm max-md:text-base outline-none transition-colors focus:border-[#D6A8E0] focus:ring-1 focus:ring-[#D6A8E0]/30";
const labelClass = "mb-2 block text-xs font-semibold tracking-tight";
const sectionCardClass = "overflow-hidden rounded-xl border border-gray-200 bg-gray-50/90 p-5";

const CHECKOUT_FORM_ID = "checkout-tunnel-form";

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

/** POST /api/orders 성공 후 ViewPay prepare 실패 시 prepare-only 재시도용 */
type PendingOrderPrepareSnapshot = {
  orderNo: string;
  totalAmount: number;
  guestCheckoutToken?: string;
  paymentSignature?: string;
};

// 배송 방식 UI 제거 — 이전 옵션별 배송비 (복구 시 참고)
// const DELIVERY_OPTIONS = [
//   { value: "parcel", label: "택배 배송", fee: 4000 },
//   { value: "quick", label: "퀵배송", fee: 5000 },
//   { value: "store_pickup", label: "스토어픽업", fee: 1000 },
// ] as const;

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const pathname = usePathname();
  const stickyAboveNav = isShopPaymentTunnelPath(pathname) ? 0 : BOTTOM_NAV_HEIGHT;
  const isGuestCheckout = searchParams?.get("guest") === "1";
  /** guest=1 이면서 비로그인 — 주문자 UI를 아코디언 없이 전체 표시 */
  const guestModeUi = isGuestCheckout && !session?.user?.id;
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
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [ordererName, setOrdererName] = useState("");
  const ordererEmail = (session?.user?.email as string) ?? "";
  const [ordererPhone, setOrdererPhone] = useState("");

  const [ordererAccordionOpen, setOrdererAccordionOpen] = useState(false);

  /** 배송 방식 선택 UI 제거 — API/주문 레코드 호환용 기본값 */
  const deliveryMethod = "parcel" as const;
  // const deliveryFee = DELIVERY_OPTIONS.find((o) => o.value === deliveryMethod)?.fee ?? 4000;
  const deliveryFee = 0;

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
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
  const [ribbonSameAsOrderer, setRibbonSameAsOrderer] = useState(false);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [saveAsDefaultAddress, setSaveAsDefaultAddress] = useState(false);

  const minDeliveryDateYmd = useMemo(() => getSeoulTodayYmd(), []);
  const [deliveryDate, setDeliveryDate] = useState(() => getSeoulTomorrowYmd());
  const DEFAULT_TIME_SLOT = "14:00~16:00";
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState(DEFAULT_TIME_SLOT);
  const [openTimeAccordion, setOpenTimeAccordion] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("card");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [guestPassword, setGuestPassword] = useState("");
  const [guestPasswordConfirm, setGuestPasswordConfirm] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  /** 주문 생성 성공 후 결제창만 실패한 경우 재시도용 (페이지 이탈 시 언마운트로 초기화) */
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingPrepareSnapshot, setPendingPrepareSnapshot] =
    useState<PendingOrderPrepareSnapshot | null>(null);
  // const [guardResumeLoading, setGuardResumeLoading] = useState(false);
  const [guardReprobeKey, setGuardReprobeKey] = useState(0);
  const [dismissedPendingOfferId, setDismissedPendingOfferId] = useState<string | null>(null);
  const [dismissedPaidNotice, setDismissedPaidNotice] = useState(false);

  const checkoutGuard = useViewpayCheckoutGuard({
    clientId,
    subdomain,
    clientSlug,
    cartLoading: loading,
    reprobeKey: guardReprobeKey,
  });

  const pendingOfferOrder =
    checkoutGuard.phase === "pending_offer" ? checkoutGuard.pendingOrder : null;
  const showPendingOffer =
    Boolean(pendingOfferOrder) &&
    pendingOfferOrder!.id !== dismissedPendingOfferId;
  const pendingCartMismatch = pendingOfferOrder
    ? hasCheckoutCartMismatch(
        items.map((i) => i.id),
        pendingOfferOrder.checkoutCartItemIds
      )
    : false;

  const addressSectionRef = useRef<HTMLDivElement>(null);
  const addressesLoadedRef = useRef(false);

  // Phase D3: ViewPay 결제창에서 취소 후 cancelUrl로 돌아온 경우
  useEffect(() => {
    const cancel = searchParams?.get("cancel");
    if (cancel === "1") {
      console.debug("[Order:Checkout] ViewPay 결제 취소 후 cancelUrl 복귀");
      toast("결제가 취소되었습니다. 주문은 유지됩니다. 아래에서 다시 결제하기를 시도하거나 마이페이지에서 주문을 확인하세요.", "error");
      setGuardReprobeKey((k) => k + 1);
      setDismissedPendingOfferId(null);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("cancel");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
  }, [searchParams]);

  // 세션 또는 비회원(guest=1) 장바구니
  useEffect(() => {
    async function loadItems() {
      if (!clientId) {
        setLoading(false);
        return;
      }
      if (sessionStatus === "loading") {
        return;
      }
      if (sessionStatus !== "authenticated" && !isGuestCheckout) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await shopFetch(`/api/cart?clientId=${clientId}`);
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
    loadItems();
  }, [clientId, selectedItemIds, session?.user?.id, sessionStatus, isGuestCheckout]);

  useEffect(() => {
    if (session?.user?.name) {
      setOrdererName((prev) => prev || (session.user.name as string));
    }
  }, [session?.user?.name]);

  useEffect(() => {
    if (!session?.user?.id || !clientId) return;
    (async () => {
      const res = await shopFetch(`/api/mypage/profile?clientId=${clientId}`);
      if (res.status === 403) {
        // 신규 거래처/회원: 아직 프로필 권한이 없더라도 체크아웃 화면은 유지
        setProfileNotice("신규 회원 정보를 입력해 주세요. 아래 주문자 정보와 배송지 정보를 채워주세요.");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const user = data.user ?? {};
        setOrdererName(user.name ?? session?.user?.name ?? "");
        setOrdererPhone(user.phone ?? "");
      }
    })();
  }, [session?.user?.id, session?.user?.name, clientId]);

  useEffect(() => {
    if (!clientId) return;
    const cid = clientId;
    async function loadAddresses() {
      const res = await shopFetch(
        `/api/mypage/addresses?clientId=${encodeURIComponent(cid)}`
      );
      if (res.ok) {
        const data = await res.json();
        const list = data.addresses || [];
        setAddresses(list);
        addressesLoadedRef.current = true;

        if (list.length > 0) {
          const defaultAddr = list.find((a: Address) => a.is_default) || list[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
            setShippingName(defaultAddr.name);
            setShippingPhone(defaultAddr.phone);
            setShippingPostcode(defaultAddr.postcode || "");
            setShippingAddress(defaultAddr.address);
            setVenueDetail(defaultAddr.detail || "");
          }
        } else {
          /* no saved addresses */
        }
      }
    }
    loadAddresses();
  }, [clientId, isGuestCheckout]);

  useEffect(() => {
    if (!addressesLoadedRef.current || addresses.length > 0) return;
    setShippingName((prev) => (prev ? prev : ordererName || ""));
    setShippingPhone((prev) => (prev ? prev : ordererPhone || ""));
  }, [addresses.length, ordererName, ordererPhone]);

  useEffect(() => {
    if (ribbonSameAsOrderer) {
      setRibbonSender(ordererName.trim());
    }
  }, [ordererName, ribbonSameAsOrderer]);

  const formatPrice = (price: number) => new Intl.NumberFormat("ko-KR").format(price);
  const getItemUnit = (item: CartItem) => {
    const p = {
      base_price: item.product.base_price,
      sale_price: item.product.sale_price,
      member_price: item.product.member_price ?? null,
    };
    return session?.user?.id
      ? effectiveMemberUnitPrice(p)
      : effectiveGuestUnitPrice(p);
  };
  const getItemPrice = (item: CartItem) => getItemUnit(item) * item.quantity;
  const getTotalProductPrice = () => items.reduce((sum, item) => sum + getItemPrice(item), 0);
  const finalTotal = getTotalProductPrice();
  const displayPayTotal =
    items.length > 0
      ? finalTotal
      : pendingPrepareSnapshot?.totalAmount ?? finalTotal;
  // + deliveryFee (배송비 계산 비활성화)

  const handleSelectAddress = (a: Address) => {
    setSelectedAddressId(a.id);
    setShippingName(a.name);
    setShippingPhone(a.phone);
    setShippingPostcode(a.postcode || "");
    setShippingAddress(a.address);
    setVenueDetail(a.detail || "");
    setShowAddressModal(false);
  };

  const openPostcodeSearch = () => {
    openDaumPostcode(({ zonecode, address }) => {
      setShippingPostcode(zonecode);
      setShippingAddress(address);
      setVenueDetail("");
    });
  };

  const prepareForOrder = async (
    order: { id: string; order_no: string; total_amount: number },
    opts: {
      guestTok?: string;
      paySig?: string;
      buyerName: string;
      buyerPhone: string;
      buyerEmail?: string;
    }
  ): Promise<boolean> => {
    toast("안전한 결제창으로 이동합니다.", "default");
    return runViewpayPreparePayment({
      subdomain,
      clientSlug,
      orderId: order.id,
      orderNo: order.order_no,
      amount: order.total_amount,
      buyerName: opts.buyerName,
      buyerPhone: opts.buyerPhone,
      buyerEmail: opts.buyerEmail,
      productName:
        items.length > 0 ? items[0].product?.name ?? "주문상품" : "주문상품",
      cancelPath: "checkout",
      isGuestCheckout: isGuestCheckout && !session?.user?.id,
      guestCheckoutToken: opts.guestTok,
      paymentSignature: opts.paySig,
    });
  };

  const handleLoadPendingOrder = async () => {
    const offer = pendingOfferOrder;
    if (!offer) return;
    const orderUrl =
      offer.isGuest && offer.guestCheckoutToken && offer.paymentSignature
        ? `/api/orders/${offer.id}?guestToken=${encodeURIComponent(offer.guestCheckoutToken)}&sig=${encodeURIComponent(offer.paymentSignature)}`
        : `/api/orders/${offer.id}`;
    const res = await shopFetch(orderUrl, {
      handleSessionExpiry: !(offer.isGuest && offer.guestCheckoutToken),
    });
    if (!res.ok) {
      toast("주문 정보를 불러오지 못했습니다.", "error");
      return;
    }
    const data = await res.json();
    const snap = extractPendingOrderFormSnapshot(
      (data.order ?? {}) as Record<string, unknown>
    );
    if (snap.ordererName) setOrdererName(snap.ordererName);
    if (snap.ordererPhone) setOrdererPhone(snap.ordererPhone);
    setShippingName(snap.shippingName);
    setShippingPhone(snap.shippingPhone);
    setShippingPostcode(snap.shippingPostcode);
    setShippingAddress(snap.shippingAddress);
    setVenueDetail(snap.venueDetail);
    if (snap.deliveryDate) setDeliveryDate(snap.deliveryDate);
    if (snap.deliveryTimeSlot) setDeliveryTimeSlot(snap.deliveryTimeSlot);
    setRibbonSender(snap.ribbonSender);
    setRibbonMessageCustom(snap.ribbonMessage);
    setRibbonPreset(snap.ribbonMessage ? "__custom__" : ribbonPreset);
    setPendingOrderId(offer.id);
    setPendingPrepareSnapshot({
      orderNo: offer.orderNo,
      totalAmount: offer.totalAmount,
      guestCheckoutToken: offer.guestCheckoutToken,
      paymentSignature: offer.paymentSignature,
    });
    setDismissedPendingOfferId(offer.id);
    toast("주문 정보를 불러왔습니다.", "info");
  };

  /*
  const handleOfferResumePayment = async () => {
    const offer = pendingOfferOrder;
    if (!offer || guardResumeLoading) return;
    setGuardResumeLoading(true);
    try {
      setPendingOrderId(offer.id);
      setPendingPrepareSnapshot({
        orderNo: offer.orderNo,
        totalAmount: offer.totalAmount,
        guestCheckoutToken: offer.guestCheckoutToken,
        paymentSignature: offer.paymentSignature,
      });
      await prepareForOrder(
        { id: offer.id, order_no: offer.orderNo, total_amount: offer.totalAmount },
        {
          guestTok: offer.guestCheckoutToken,
          paySig: offer.paymentSignature,
          buyerName: offer.buyerName,
          buyerPhone: offer.buyerPhone,
          buyerEmail: offer.buyerEmail,
        }
      );
      setDismissedPendingOfferId(offer.id);
    } finally {
      setGuardResumeLoading(false);
    }
  };
  */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privacyAgreed) {
      toast("개인정보 수집 및 이용에 동의해주세요.");
      return;
    }
    if (paymentMethod !== "card") {
      toast("현재 신용카드 결제만 가능합니다. 무통장 입금은 추후 지원 예정입니다.");
      return;
    }
    if (!template?.orderAllowed) {
      toast("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
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
    const name = shippingName.trim();
    const phoneDigits = digitsOnlyPhone(shippingPhone);
    const postcode = shippingPostcode.trim();
    const address = shippingAddress.trim();

    const resolvedRibbonMessage = resolveRibbonPhrase(ribbonPreset, ribbonMessageCustom);
    const trimmedCardExtra = combinedRibbonAndCard ? "" : ribbonCardExtra.trim();

    const on = ordererName.trim();
    const op = digitsOnlyPhone(ordererPhone);

    if (!on || op.length < 8) {
      toast("주문자 성명과 연락처를 올바르게 입력해 주세요.");
      return;
    }
    if (!name || !phoneDigits || phoneDigits.length < 8) {
      toast("수령인 성명과 연락처를 올바르게 입력해 주세요.");
      addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (isDeliveryDateInPast(deliveryDate)) {
      toast("배달 일시는 과거 날짜를 선택할 수 없습니다.");
      return;
    }
    if (!address) {
      toast("배달지 주소를 입력해 주세요. 우편번호 찾기를 이용해 주세요.");
      addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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

    const shippingDetailBlob = buildFloristShippingDetailText({
      venueDetail,
      deliveryDate,
      deliveryTimeSlot,
      ordererName: on,
      ordererPhone: op,
      ribbonSender: ribbonSender.trim(),
      ribbonMessage: resolvedRibbonMessage,
      ribbonCardMessage: trimmedCardExtra || undefined,
    });

    const isGuestOrder = isGuestCheckout && !session?.user?.id;
    if (isGuestOrder) {
      if (guestPassword.trim().length < 4) {
        toast("주문 조회용 비밀번호는 4자 이상 입력해 주세요.");
        return;
      }
      if (guestPassword !== guestPasswordConfirm) {
        toast("비밀번호 확인이 일치하지 않습니다.");
        return;
      }
      const guestEm = guestEmail.trim();
      if (guestEm && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEm)) {
        toast("이메일 형식을 확인해 주세요.");
        return;
      }
    }

    setSubmitting(true);

    try {
      if (pendingOrderId && pendingPrepareSnapshot) {
        await prepareForOrder(
          {
            id: pendingOrderId,
            order_no: pendingPrepareSnapshot.orderNo,
            total_amount: pendingPrepareSnapshot.totalAmount,
          },
          {
            guestTok: pendingPrepareSnapshot.guestCheckoutToken,
            paySig: pendingPrepareSnapshot.paymentSignature,
            buyerName: on || name,
            buyerPhone: op || phoneDigits,
            buyerEmail:
              isGuestCheckout && !session?.user?.id
                ? guestEmail.trim()
                : ordererEmail || "",
          }
        );
        return;
      }

      const orderPayload: Record<string, unknown> = {
        partnerId,
        clientId,
        cartItemIds: items.map((i) => i.id),
        shippingName: name,
        shippingPhone: phoneDigits,
        shippingPostcode: postcode || "00000",
        shippingAddress: address,
        shippingDetail: shippingDetailBlob,
        detailPlace: venueDetail.trim(),
        deliveryDate: deliveryDate || null,
        deliveryTimeSlot: deliveryTimeSlot || DEFAULT_TIME_SLOT,
        deliveryMethod,
        deliveryFee,
        ordererName: on,
        ribbonSender: ribbonSender.trim(),
        ribbonMessage: resolvedRibbonMessage,
        ribbonCardMessage: trimmedCardExtra || undefined,
        paymentMethod,
      };
      if (isGuestOrder) {
        orderPayload.isGuest = true;
        orderPayload.guestPassword = guestPassword.trim();
        if (guestEmail.trim()) {
          orderPayload.guestOrdererEmail = guestEmail.trim();
        }
      }
      console.debug("[Order:Checkout] 주문 생성 요청", {
        partnerId,
        clientId,
        cartItemCount: items.length,
      });

      const res = await shopFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      if (!res.ok) {
        const err = await res.json();
        console.debug("[Order:Checkout] 주문 생성 실패", {
          status: res.status,
          error: err.error,
          details: err.details,
        });
        const detail = typeof err.details === "string" ? err.details : "";
        toast(
          detail ? `${err.error || "주문에 실패했습니다."} (${detail})` : err.error || "주문에 실패했습니다.",
          "error"
        );
        return;
      }

      const data = await res.json();
      const order = data.order as { id: string; order_no: string; total_amount: number };
      const guestTok = data.guestCheckoutToken as string | undefined;
      const paySig = data.paymentSignature as string | undefined;
      if (data.idempotentReorder) {
        toast("진행 중인 주문으로 결제를 이어갑니다.", "info");
      }
      console.debug("[Order:Checkout] 주문 생성 완료", {
        orderId: order.id,
        order_no: order.order_no,
        total_amount: order.total_amount,
        idempotentReorder: Boolean(data.idempotentReorder),
      });
      setPendingOrderId(order.id);
      setPendingPrepareSnapshot({
        orderNo: order.order_no,
        totalAmount: order.total_amount,
        guestCheckoutToken: guestTok,
        paymentSignature: paySig,
      });

      if (saveAsDefaultAddress && session?.user?.id) {
        shopFetch("/api/mypage/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            name,
            phone: phoneDigits,
            postcode: postcode || "",
            address,
            detail: venueDetail.trim() || undefined,
            isDefault: true,
          }),
        }).catch(() => {});
      }

      const redirected = await prepareForOrder(order, {
        guestTok,
        paySig,
        buyerName: on || name,
        buyerPhone: op || phoneDigits,
        buyerEmail:
          isGuestCheckout && !session?.user?.id
            ? guestEmail.trim()
            : ordererEmail || "",
      });
      if (!redirected) {
        toast(
          "결제창을 열 수 없습니다. 아래에서 결제하기를 다시 시도해 주세요.",
          "error"
        );
      }
    } catch (e) {
      console.debug("[Order:Checkout] 예외", e);
      toast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setSubmitting(false);
    }
  };


  if (template == null || !partnerId || !clientId) {
    return <div className="min-h-screen" style={{ backgroundColor: "#FAFAFA" }} />;
  }

  const showCheckoutForm = items.length > 0 || Boolean(pendingOrderId);

  if (!showCheckoutForm) {
    const guideShell = (content: React.ReactNode) => (
      <OrderGuard
        partnerId={partnerId}
        shopClientId={clientId ?? undefined}
        shopClientName={template?.client?.name ?? undefined}
        requireAuth={!isGuestCheckout}
        blockAffiliationMismatch={!isGuestCheckout}
      >
        {content}
      </OrderGuard>
    );

    if (loading || checkoutGuard.phase === "loading") {
      return guideShell(<CheckoutOrderGuideLoading />);
    }

    return guideShell(
      <>
        <CheckoutOrderGuideEmpty
          subdomain={subdomain}
          clientSlug={clientSlug}
          showCartButton
        />
        {showPendingOffer && pendingOfferOrder ? (
          <CheckoutOrderGuidePendingOffer
            order={pendingOfferOrder}
            cartMismatch={pendingCartMismatch}
            onLoadOrder={() => void handleLoadPendingOrder()}
            onDismiss={() => setDismissedPendingOfferId(pendingOfferOrder.id)}
          />
        ) : null}
      </>
    );
  }

  const paidNoticeVisible =
    checkoutGuard.phase === "paid_notice" &&
    checkoutGuard.pendingOrder &&
    checkoutGuard.completePath &&
    !dismissedPaidNotice;

  const paymentLineProductSum = items.length > 0 ? getTotalProductPrice() : displayPayTotal;

  const SectionDivider = () => <div className="h-2 bg-gray-100" aria-hidden />;

  const CheckoutMainSections = (
    <div className="space-y-0">
      {/* 1. 주문상품 — 비회원 주문서와 동일 레이아웃 */}
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
                {item.option_json && (
                  <p className="mt-0.5 text-xs" style={{ color: TEXT_MUTED }}>
                    {Object.entries(item.option_json)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </p>
                )}
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

      {/* 2. 주문자 */}
      {guestModeUi ? (
        <section className="py-4">
          <div
            className={`${sectionCardClass} border-amber-200/80 bg-amber-50/80`}
            aria-label="비회원 주문자 정보"
          >
            <h2 className="mb-3 text-base font-bold text-amber-900">2. 주문자 정보</h2>
            <p className="mb-3 text-xs leading-snug text-amber-900/75">
              받으시는 분과 동일하면 아래 배달지에도 같은 이름·연락처를 입력해 주세요.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-amber-900/80">이름</label>
                <input
                  type="text"
                  inputMode="text"
                  enterKeyHint="next"
                  value={ordererName}
                  onChange={(e) => setOrdererName(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-3 text-sm max-md:text-base min-h-[48px]"
                  placeholder="주문하시는 분 성함"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-amber-900/80">휴대폰 번호</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  enterKeyHint="next"
                  value={ordererPhone}
                  onChange={(e) => setOrdererPhone(digitsOnlyPhone(e.target.value))}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-3 text-sm max-md:text-base min-h-[48px]"
                  placeholder="01012345678 (숫자만)"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-amber-900/80">
                  이메일 (선택)
                </label>
                <input
                  type="email"
                  enterKeyHint="next"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-3 text-sm max-md:text-base min-h-[48px]"
                  placeholder="example@email.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-amber-900/80">주문 조회 비밀번호</label>
                <input
                  type="password"
                  enterKeyHint="next"
                  value={guestPassword}
                  onChange={(e) => setGuestPassword(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-3 text-sm max-md:text-base min-h-[48px]"
                  placeholder="4자 이상"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-amber-900/80">비밀번호 확인</label>
                <input
                  type="password"
                  enterKeyHint="done"
                  value={guestPasswordConfirm}
                  onChange={(e) => setGuestPasswordConfirm(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-3 text-sm max-md:text-base min-h-[48px]"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-4">
          <div className={sectionCardClass}>
            <h2 className="mb-4 text-base font-bold" style={{ color: TEXT }}>
              2. 주문자 정보
            </h2>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setOrdererAccordionOpen((v) => !v)}
                className="flex w-full min-h-[48px] items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm" style={{ color: TEXT_MUTED }}>
                  주문하시는 분
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-base font-bold" style={{ color: TEXT }}>
                    {ordererName || "정보 입력"}
                  </span>
                  {ordererAccordionOpen ? (
                    <ChevronUp size={20} style={{ color: TEXT_MUTED }} />
                  ) : (
                    <ChevronDown size={20} style={{ color: TEXT_MUTED }} />
                  )}
                </span>
              </button>
              {ordererAccordionOpen && (
                <div className="border-t border-gray-200 bg-gray-50 px-5 pb-5 pt-4">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium" style={{ color: TEXT_MUTED }}>
                        이름
                      </label>
                      <span className="block text-sm font-semibold" style={{ color: TEXT }}>
                        {ordererName || "-"}
                      </span>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium" style={{ color: TEXT_MUTED }}>
                        휴대폰 번호
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        enterKeyHint="next"
                        value={ordererPhone}
                        onChange={(e) => setOrdererPhone(digitsOnlyPhone(e.target.value))}
                        onFocus={checkoutFieldFocusScroll}
                        onKeyDown={checkoutInputEnterGoNext}
                        placeholder="01012345678 (숫자만)"
                        className="w-full min-h-[48px] rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm max-md:text-base outline-none transition-colors focus:border-[#D6A8E0] focus:ring-1 focus:ring-[#D6A8E0]/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium" style={{ color: TEXT_MUTED }}>
                        이메일
                      </label>
                      <span className="block truncate text-sm" style={{ color: TEXT }}>
                        {ordererEmail || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <SectionDivider />

      <section ref={addressSectionRef} className="py-4">
        <div className={sectionCardClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold" style={{ color: TEXT }}>
              3. 수령인 정보
            </h2>
            {session?.user?.id && addresses.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowAddressModal(true)}
                className="flex items-center gap-0.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-900 transition-colors hover:bg-white/80"
                style={{ borderColor: BORDER }}
              >
                저장된 배송지
                <ChevronRight size={14} className="opacity-70" aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-5">
            <div>
              <label className={labelClass} style={{ color: TEXT_MUTED }}>
                수령인 성명 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="text"
                enterKeyHint="next"
                value={shippingName}
                onChange={(e) => setShippingName(e.target.value)}
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
                value={shippingPhone}
                onChange={(e) => setShippingPhone(digitsOnlyPhone(e.target.value))}
                onFocus={checkoutFieldFocusScroll}
                onKeyDown={checkoutInputEnterGoNext}
                className={inputClass}
                placeholder="01012345678 (숫자만)"
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
                    className="min-h-[52px] min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-3 text-sm max-md:text-base"
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
                      {openTimeAccordion ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
                빈소·예식장 호실, 층수, 홀 이름 등 배달 기사님이 찾으실 수 있게 적어 주세요.
              </p>
              <input
                type="text"
                inputMode="text"
                enterKeyHint="done"
                value={venueDetail}
                onChange={(e) => setVenueDetail(e.target.value)}
                onFocus={checkoutFieldFocusScroll}
                onKeyDown={checkoutInputEnterGoNext}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3.5 text-sm max-md:text-base outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-300/50"
                placeholder="예) 아산병원 장례식장 201호, 3층 그랜드홀"
              />
            </div>
            {session?.user?.id ? (
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveAsDefaultAddress}
                  onChange={(e) => setSaveAsDefaultAddress(e.target.checked)}
                  className="accent-[#D6A8E0]"
                />
                <span className="text-sm" style={{ color: TEXT }}>
                  이 배송지를 기본 배송지로 저장
                </span>
              </label>
            ) : null}
          </div>
        </div>
      </section>

      <SectionDivider />

      <section className="py-4">
        <div className={sectionCardClass}>
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
            ribbonSameAsOrderer={ribbonSameAsOrderer}
            onRibbonSameAsOrdererChange={setRibbonSameAsOrderer}
            ordererNameForSame={ordererName}
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
        </div>
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
  );

  return (
    <OrderGuard
      partnerId={partnerId}
      shopClientId={clientId ?? undefined}
      shopClientName={template?.client?.name ?? undefined}
      requireAuth={!isGuestCheckout}
      blockAffiliationMismatch={!isGuestCheckout}
    >
      <form
        id={CHECKOUT_FORM_ID}
        onSubmit={handleSubmit}
        className="checkout-tunnel-form mx-auto min-h-[100svh] max-w-[430px] bg-white lg:max-w-6xl lg:px-6"
        style={checkoutTunnelFormStyle(stickyAboveNav)}
      >
        <div className="px-4 py-4 lg:py-6">
          {paidNoticeVisible &&
          checkoutGuard.pendingOrder &&
          checkoutGuard.completePath ? (
            <CheckoutOrderGuidePaidNotice
              orderNo={checkoutGuard.pendingOrder.orderNo}
              completePath={checkoutGuard.completePath}
              onDismiss={() => setDismissedPaidNotice(true)}
            />
          ) : null}
          {pendingOrderId && pendingPrepareSnapshot && (
            <div
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
              role="status"
            >
              결제창을 불러오지 못했습니다. 주문번호 {pendingPrepareSnapshot.orderNo}. 아래{" "}
              <strong>결제하기</strong>를 다시 눌러 주세요.
            </div>
          )}
          {CheckoutMainSections}
        </div>
      </form>

      <CheckoutStickyFooterPortal
        stickyAboveNav={stickyAboveNav}
        borderColor={BORDER}
        wideOnDesktop
      >
        <label className="mb-3 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={privacyAgreed}
            onChange={(e) => setPrivacyAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#D6A8E0]"
          />
          <span className="text-xs leading-tight" style={{ color: TEXT_MUTED }}>
            개인정보 수집 및 이용에 동의합니다. (필수)
          </span>
        </label>
        <button
          type="submit"
          form={CHECKOUT_FORM_ID}
          disabled={submitting}
          className="w-full rounded-xl py-4 text-base font-bold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: submitting ? "#9CA3AF" : PRIMARY }}
        >
          {`${formatPrice(displayPayTotal)}원 결제하기`}
        </button>
      </CheckoutStickyFooterPortal>

      {showPendingOffer && pendingOfferOrder ? (
        <CheckoutOrderGuidePendingOffer
          order={pendingOfferOrder}
          cartMismatch={pendingCartMismatch}
          onLoadOrder={() => void handleLoadPendingOrder()}
          onDismiss={() => setDismissedPendingOfferId(pendingOfferOrder.id)}
        />
      ) : null}

      {clientId && (
        <AddressSelectModal
          isOpen={showAddressModal}
          onClose={() => setShowAddressModal(false)}
          clientId={clientId}
          addresses={addresses}
          selectedId={selectedAddressId}
          onSelect={handleSelectAddress}
          ordererName={ordererName}
          ordererPhone={ordererPhone}
        />
      )}
    </OrderGuard>
  );
}

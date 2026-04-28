"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  isCheckoutTestDefaultsEnabled,
  CHECKOUT_TEST_DEFAULTS,
} from "@/lib/checkout-test-defaults";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, Calendar, ChevronRight } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { BOTTOM_NAV_HEIGHT } from "@/components/shop/ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";
import { isShopPaymentTunnelPath } from "@/lib/shop-payment-tunnel";
import { checkoutFieldFocusScroll, checkoutInputEnterGoNext } from "@/lib/checkout-form-ux";
import { toast } from "@/components/shop/ToastContext";
import { AddressSelectModal, type Address } from "@/components/shop/AddressSelectModal";
import {
  effectiveGuestUnitPrice,
  effectiveMemberUnitPrice,
} from "@/lib/product-pricing";

/**
 * 주문서(Checkout) - 네이버 쇼핑 결제 프로세스 99% 일치
 * /{subdomain}/{clientSlug}/checkout
 */

const PRIMARY = "#D6A8E0";
const PRIMARY_LIGHT = "#F3E8F5";
const TEXT = "#333333";
const TEXT_MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const CARD_RADIUS = "12px";
const PAYMENT_BG = "#F5F0F8";
const ACCENT_DARK = "#5B21B6";
const DELIVERY_NOTE_OPTIONS = [
  { value: "", label: "배송 요청사항을 선택해주세요" },
  { value: "door", label: "문 앞에 놓아주세요" },
  { value: "guard", label: "부재 시 경비실에 맡겨주세요" },
  { value: "parcel_box", label: "부재 시 택배함에 넣어주세요" },
  { value: "custom", label: "직접 입력" },
];

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

const TIME_SLOTS = [
  "09:00~11:00",
  "11:00~13:00",
  "13:00~15:00",
  "14:00~16:00",
  "15:00~17:00",
  "17:00~19:00",
];

function getTomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

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
  const [shippingDetail, setShippingDetail] = useState("");
  const [deliveryNotePreset, setDeliveryNotePreset] = useState("");
  const [deliveryNoteCustom, setDeliveryNoteCustom] = useState("");

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [saveAsDefaultAddress, setSaveAsDefaultAddress] = useState(false);

  const [openDateAccordion, setOpenDateAccordion] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(() => getTomorrowDateString());
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

  const addressSectionRef = useRef<HTMLDivElement>(null);
  const addressesLoadedRef = useRef(false);
  const checkoutTestDefaultsAppliedRef = useRef(false);

  useEffect(() => {
    const guest = isGuestCheckout && !session?.user?.id;
    if (!guest || !isCheckoutTestDefaultsEnabled() || checkoutTestDefaultsAppliedRef.current) return;
    if (sessionStatus === "loading") return;
    checkoutTestDefaultsAppliedRef.current = true;
    const d = CHECKOUT_TEST_DEFAULTS;
    setOrdererName(d.ordererName);
    setOrdererPhone(d.ordererPhone);
    setGuestEmail(d.guestEmail);
    setGuestPassword(d.guestPassword);
    setGuestPasswordConfirm(d.guestPassword);
    setShippingName(d.recipientName);
    setShippingPhone(d.recipientPhone);
    setShippingPostcode(d.shippingPostcode);
    setShippingAddress(d.shippingAddress);
    setShippingDetail(d.shippingDetail);
    setShowAddressForm(true);
  }, [isGuestCheckout, session?.user?.id, sessionStatus]);

  // Phase D3: ViewPay 결제창에서 취소 후 cancelUrl로 돌아온 경우
  useEffect(() => {
    const cancel = searchParams?.get("cancel");
    if (cancel === "1") {
      console.debug("[Order:Checkout] ViewPay 결제 취소 후 cancelUrl 복귀");
      toast("결제가 취소되었습니다. 주문은 유지됩니다. 아래에서 다시 결제하기를 시도하거나 마이페이지에서 주문을 확인하세요.", "error");
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
            setShippingDetail(defaultAddr.detail || "");
          }
        } else {
          if (!(isGuestCheckout && isCheckoutTestDefaultsEnabled())) {
            setShowAddressForm(false);
          }
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
    setShippingDetail(a.detail || "");
    setShowAddressForm(false);
  };

  const handleAddNewAddress = () => {
    setShowAddressForm(true);
    setSelectedAddressId(null);
    setShippingName((prev) => prev || ordererName || "");
    setShippingPhone((prev) => prev || ordererPhone || "");
    setShippingPostcode("");
    setShippingAddress("");
    setShippingDetail("");
  };

  const postcodeScriptLoaded = useRef(false);
  useEffect(() => {
    if (postcodeScriptLoaded.current || typeof window === "undefined") return;
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);
    postcodeScriptLoaded.current = true;
  }, []);

  const openPostcodeSearch = () => {
    if (!window.daum?.Postcode) {
      toast("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete(data) {
        setShippingPostcode(data.zonecode || "");
        setShippingAddress(data.address || "");
        setShippingDetail("");
        setShowAddressForm(true);
      },
    }).open();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privacyAgreed) {
      toast("개인정보 수집 및 이용에 동의해주세요.");
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
    const name = shippingName;
    const phone = shippingPhone;
    const postcode = shippingPostcode;
    let address = shippingAddress;
    let detail = shippingDetail;
    const noteText =
      deliveryNotePreset === ""
        ? ""
        : deliveryNotePreset === "custom"
          ? deliveryNoteCustom
          : DELIVERY_NOTE_OPTIONS.find((o) => o.value === deliveryNotePreset)?.label || "";
    if (noteText) {
      detail = detail ? `${detail} / ${noteText}` : noteText;
    }
    if (!name || !phone || !address) {
      toast("배송지 정보를 모두 입력해주세요.");
      if (!address) {
        addressSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

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
      if (!guestEmail.trim()) {
        toast("결제 안내를 위해 이메일을 입력해 주세요.");
        return;
      }
    }

    setSubmitting(true);

    const runViewPayPrepare = async (
      order: { id: string; order_no: string; total_amount: number },
      guestTok?: string,
      paySig?: string
    ): Promise<boolean> => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      let returnUrl = `${origin}/${subdomain}/${clientSlug}/order/complete?orderId=${order.id}`;
      if (guestTok && paySig) {
        returnUrl += `&guestToken=${encodeURIComponent(guestTok)}&sig=${encodeURIComponent(paySig)}`;
      }
      const cancelUrl = `${origin}/${subdomain}/${clientSlug}/checkout?cancel=1`;
      const productName =
        items.length > 0 ? items[0].product?.name ?? "주문상품" : "주문상품";
      const prepareBody: Record<string, unknown> = {
        orderId: order.id,
        orderNo: order.order_no,
        amount: order.total_amount,
        productName,
        returnUrl,
        cancelUrl,
        buyerName: ordererName || name,
        buyerPhone: ordererPhone || phone,
        buyerEmail:
          isGuestCheckout && !session?.user?.id
            ? guestEmail.trim()
            : ordererEmail || "",
      };
      if (guestTok && paySig) {
        prepareBody.guestCheckoutToken = guestTok;
        prepareBody.paymentSignature = paySig;
      }
      console.debug("[Order:Checkout] ViewPay prepare 요청", {
        orderId: order.id,
        amount: order.total_amount,
        returnUrl,
      });
      const prepareRes = await shopFetch("/api/payment/viewpay/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prepareBody),
      });
      const prepareData = await prepareRes.json().catch(() => ({}));
      if (prepareRes.ok && prepareData.success && prepareData.redirectUrl) {
        console.debug("[Order:Checkout] ViewPay redirect 이동", {
          redirectUrlPreview: prepareData.redirectUrl?.slice(0, 80),
        });
        window.location.href = prepareData.redirectUrl;
        return true;
      }
      console.debug("[Order:Checkout] ViewPay prepare 실패", {
        ok: prepareRes.ok,
        message: prepareData.message,
      });
      toast(
        prepareData.message ||
          "결제창을 열 수 없습니다. 아래에서 결제하기를 다시 눌러 주시거나 마이페이지에서 재결제할 수 있습니다.",
        "error"
      );
      return false;
    };

    try {
      if (pendingOrderId && pendingPrepareSnapshot) {
        toast("안전한 결제창으로 이동합니다.", "default");
        await runViewPayPrepare(
          {
            id: pendingOrderId,
            order_no: pendingPrepareSnapshot.orderNo,
            total_amount: pendingPrepareSnapshot.totalAmount,
          },
          pendingPrepareSnapshot.guestCheckoutToken,
          pendingPrepareSnapshot.paymentSignature
        );
        return;
      }

      const orderPayload: Record<string, unknown> = {
        partnerId,
        clientId,
        cartItemIds: items.map((i) => i.id),
        shippingName: name,
        shippingPhone: phone,
        shippingPostcode: postcode || undefined,
        shippingAddress: address,
        shippingDetail: detail || undefined,
        deliveryDate: deliveryDate || null,
        deliveryTimeSlot: deliveryTimeSlot || DEFAULT_TIME_SLOT,
        deliveryMethod,
        deliveryFee,
        deliveryRequestMemo: noteText || undefined,
        paymentMethod,
      };
      if (ordererName.trim()) {
        orderPayload.ordererName = ordererName.trim();
      }
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
        });
        toast(err.error || "주문에 실패했습니다.", "error");
        return;
      }

      const data = await res.json();
      const order = data.order as { id: string; order_no: string; total_amount: number };
      const guestTok = data.guestCheckoutToken as string | undefined;
      const paySig = data.paymentSignature as string | undefined;
      console.debug("[Order:Checkout] 주문 생성 완료", {
        orderId: order.id,
        order_no: order.order_no,
        total_amount: order.total_amount,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cart-updated"));
      }

      if (saveAsDefaultAddress && session?.user?.id) {
        shopFetch("/api/mypage/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            name,
            phone,
            postcode: postcode || "",
            address,
            detail: detail || undefined,
            isDefault: true,
          }),
        }).catch(() => {});
      }

      toast("안전한 결제창으로 이동합니다.", "default");
      const redirected = await runViewPayPrepare(order, guestTok, paySig);
      if (!redirected) {
        setPendingOrderId(order.id);
        setPendingPrepareSnapshot({
          orderNo: order.order_no,
          totalAmount: order.total_amount,
          guestCheckoutToken: guestTok,
          paymentSignature: paySig,
        });
      }
    } catch (e) {
      console.debug("[Order:Checkout] 예외", e);
      toast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const hasValidAddress = !!(shippingName && shippingPhone && shippingAddress);

  if (template == null || !partnerId || !clientId || loading) {
    return <div className="min-h-screen" style={{ backgroundColor: "#FAFAFA" }} />;
  }

  if (!pendingOrderId && items.length === 0) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: "#FAFAFA" }}
      >
        <h1 className="mb-2 text-lg font-bold" style={{ color: TEXT }}>
          주문할 상품이 없습니다
        </h1>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/${clientSlug}/cart`)}
          className="mt-4 rounded-xl px-6 py-3 text-white font-medium"
          style={{ backgroundColor: PRIMARY }}
        >
          장바구니로 이동
        </button>
      </div>
    );
  }

  const paymentLineProductSum = items.length > 0 ? getTotalProductPrice() : displayPayTotal;

  const SectionDivider = () => <div className="h-2 bg-gray-100" aria-hidden />;

  const LeftColumn = (
    <div className="space-y-0">
      {/* (1) 주문자 정보 - DB 연동형 스마트 아코디언 */}
      <section className="py-4">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => setOrdererAccordionOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-sm" style={{ color: TEXT_MUTED }}>
              주문자 정보
            </span>
            <span className="flex items-center gap-2">
              <span className="text-base font-bold" style={{ color: TEXT }}>
                {ordererName || ""}
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
                    onChange={(e) => setOrdererPhone(e.target.value)}
                    onFocus={checkoutFieldFocusScroll}
                    onKeyDown={checkoutInputEnterGoNext}
                    placeholder="010-0000-0000"
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[#D6A8E0] focus:ring-1 focus:ring-[#D6A8E0]/30"
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
      </section>

      <SectionDivider />

      {/* (2) 배송지 - 요약 카드 + 배송 요청사항 선택 박스 */}
      <section ref={addressSectionRef} className="py-4">
        <h2 className="mb-3 text-base font-bold" style={{ color: TEXT }}>
          배송지
        </h2>

        {!showAddressForm && hasValidAddress ? (
          /* 요약 카드 + 배송 메모 */
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedAddress?.is_default && (
                      <span
                        className="rounded px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: PRIMARY_LIGHT, color: PRIMARY }}
                      >
                        기본배송지
                      </span>
                    )}
                    <span className="font-medium" style={{ color: TEXT }}>
                      {shippingName} · {shippingPhone}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm" style={{ color: TEXT_MUTED }}>
                    {shippingAddress} {shippingDetail || ""}
                    {shippingPostcode ? ` (${shippingPostcode})` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddressModal(true)}
                  className="shrink-0 rounded border px-3 py-1.5 text-sm font-medium"
                  style={{ borderColor: BORDER, color: TEXT_MUTED }}
                >
                  변경
                </button>
              </div>
            </div>
            {/* 배송 요청사항 선택 박스 */}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: TEXT_MUTED }}>
                배송 요청사항
              </label>
              <select
                value={deliveryNotePreset}
                onChange={(e) => setDeliveryNotePreset(e.target.value)}
                onFocus={checkoutFieldFocusScroll}
                onKeyDown={checkoutInputEnterGoNext}
                enterKeyHint="next"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                style={{ color: TEXT }}
              >
                {DELIVERY_NOTE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {deliveryNotePreset === "custom" && (
                <input
                  type="text"
                  enterKeyHint="next"
                  placeholder="요청사항을 입력해주세요"
                  value={deliveryNoteCustom}
                  onChange={(e) => setDeliveryNoteCustom(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                  style={{ color: TEXT }}
                />
              )}
            </div>
          </div>
        ) : addresses.length > 0 && !showAddressForm ? (
          <button
            type="button"
            onClick={() => setShowAddressModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-6 transition-colors hover:bg-gray-50"
          >
            <span className="font-medium text-gray-700">
              배송지를 선택해주세요
            </span>
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        ) : (
          /* 신규: [배송지를 입력해주세요 >] - 클릭 시 주소 검색 창 즉시 */
          <div className="space-y-4">
            {!hasValidAddress && !showAddressForm ? (
              <button
                type="button"
                onClick={openPostcodeSearch}
                className="flex w-full items-center justify-between rounded-lg border-2 border-gray-200 bg-white py-5 px-5 transition-colors hover:bg-gray-50"
                style={{ borderColor: PRIMARY, color: PRIMARY }}
              >
                <span className="text-base font-semibold">배송지를 입력해주세요</span>
                <ChevronRight size={22} />
              </button>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: TEXT }}>
                    배송지 입력
                  </span>
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAddressForm(false)}
                      className="text-xs"
                      style={{ color: TEXT_MUTED }}
                    >
                      취소
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium" style={{ color: TEXT_MUTED }}>
                      수령인명 *
                    </label>
                    <input
                      type="text"
                      inputMode="text"
                      enterKeyHint="next"
                      placeholder="받는 분 성함"
                      value={shippingName}
                      onChange={(e) => setShippingName(e.target.value)}
                      onFocus={checkoutFieldFocusScroll}
                      onKeyDown={checkoutInputEnterGoNext}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                      style={{ color: TEXT }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium" style={{ color: TEXT_MUTED }}>
                      주소 *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        enterKeyHint="next"
                        placeholder="우편번호"
                        value={shippingPostcode}
                        onChange={(e) => setShippingPostcode(e.target.value)}
                        onFocus={checkoutFieldFocusScroll}
                        onKeyDown={checkoutInputEnterGoNext}
                        className="w-20 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                        style={{ color: TEXT }}
                      />
                      <button
                        type="button"
                        onClick={openPostcodeSearch}
                        className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-bold transition-colors hover:bg-gray-50"
                        style={{ color: PRIMARY }}
                      >
                        주소 검색
                      </button>
                    </div>
                    <input
                      type="text"
                      enterKeyHint="next"
                      placeholder="기본 주소"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      onFocus={checkoutFieldFocusScroll}
                      onKeyDown={checkoutInputEnterGoNext}
                      className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                      style={{ color: TEXT }}
                    />
                    <input
                      type="text"
                      enterKeyHint="next"
                      placeholder="상세 주소 (동/호수 등)"
                      value={shippingDetail}
                      onChange={(e) => setShippingDetail(e.target.value)}
                      onFocus={checkoutFieldFocusScroll}
                      onKeyDown={checkoutInputEnterGoNext}
                      className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                      style={{ color: TEXT }}
                    />
                    <label className="mt-3 flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={saveAsDefaultAddress}
                        onChange={(e) => setSaveAsDefaultAddress(e.target.checked)}
                        className="accent-[#D6A8E0]"
                      />
                      <span className="text-sm" style={{ color: TEXT }}>
                        이 주소를 기본 배송지로 저장
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium" style={{ color: TEXT_MUTED }}>
                      휴대전화 *
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      enterKeyHint="next"
                      placeholder="010-0000-0000"
                      value={shippingPhone}
                      onChange={(e) => setShippingPhone(e.target.value)}
                      onFocus={checkoutFieldFocusScroll}
                      onKeyDown={checkoutInputEnterGoNext}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                      style={{ color: TEXT }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium" style={{ color: TEXT_MUTED }}>
                      배송 요청사항
                    </label>
                    <select
                      value={deliveryNotePreset}
                      onChange={(e) => setDeliveryNotePreset(e.target.value)}
                      onFocus={checkoutFieldFocusScroll}
                      onKeyDown={checkoutInputEnterGoNext}
                      enterKeyHint="next"
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                      style={{ color: TEXT }}
                    >
                      {DELIVERY_NOTE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {deliveryNotePreset === "custom" && (
                      <input
                        type="text"
                        enterKeyHint="next"
                        placeholder="요청사항을 입력해주세요"
                        value={deliveryNoteCustom}
                        onChange={(e) => setDeliveryNoteCustom(e.target.value)}
                        onFocus={checkoutFieldFocusScroll}
                        onKeyDown={checkoutInputEnterGoNext}
                        className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                        style={{ color: TEXT }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 희망배송일/시간 (아코디언) */}
        <div className="mt-4 space-y-2">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={() => setOpenDateAccordion((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left"
            >
              <span className="text-sm" style={{ color: TEXT }}>
                희망배송일
              </span>
              <span className="flex items-center gap-4">
                <span className="text-sm" style={{ color: TEXT_MUTED }}>
                  {deliveryDate ? deliveryDate.replace(/-/g, ". ") : "선택 안 함"}
                </span>
                {openDateAccordion ? (
                  <ChevronUp size={16} style={{ color: TEXT_MUTED }} />
                ) : (
                  <ChevronDown size={16} style={{ color: TEXT_MUTED }} />
                )}
              </span>
            </button>
            {openDateAccordion && (
              <div className="border-t border-gray-200 px-5 pb-4 pt-3">
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <Calendar size={18} style={{ color: PRIMARY }} />
                  <input
                    type="date"
                    enterKeyHint="next"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    onFocus={checkoutFieldFocusScroll}
                    onKeyDown={checkoutInputEnterGoNext}
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 border-0 bg-transparent py-1 text-sm outline-none"
                    style={{ color: TEXT }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={() => setOpenTimeAccordion((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left"
            >
              <span className="text-sm" style={{ color: TEXT }}>
                희망배송시간
              </span>
              <span className="flex items-center gap-4">
                <span className="text-sm" style={{ color: TEXT_MUTED }}>
                  {deliveryTimeSlot || "선택"}
                </span>
                {openTimeAccordion ? (
                  <ChevronUp size={16} style={{ color: TEXT_MUTED }} />
                ) : (
                  <ChevronDown size={16} style={{ color: TEXT_MUTED }} />
                )}
              </span>
            </button>
            {openTimeAccordion && (
              <div className="border-t border-gray-200 px-5 pb-4 pt-3">
                <select
                  value={deliveryTimeSlot}
                  onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                  onFocus={checkoutFieldFocusScroll}
                  onKeyDown={checkoutInputEnterGoNext}
                  enterKeyHint="next"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
                  style={{ color: TEXT }}
                >
                  <option value="">시간대 선택</option>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* (3) 주문 상품 목록 */}
      <section className="py-4">
        <h2 className="mb-3 text-base font-bold" style={{ color: TEXT }}>
          주문 상품 ({items.length}개)
        </h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-5">
          <ul className="space-y-3">
            {items.length === 0 && pendingPrepareSnapshot ? (
              <li
                className="rounded-lg border border-gray-200 bg-white p-4 text-sm"
                style={{ color: TEXT_MUTED }}
              >
                장바구니는 비어 있지만, 접수된 주문 금액({formatPrice(displayPayTotal)}원)으로 결제를
                이어갈 수 있습니다.
              </li>
            ) : null}
            {items.map((item) => (
              <li
                key={item.id}
                className="flex gap-3 rounded-lg border border-gray-200 bg-white p-4"
              >
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
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
                <p className="text-sm font-medium" style={{ color: TEXT }}>
                  {item.product.name}
                </p>
                {item.option_json && (
                  <p className="mt-0.5 text-xs" style={{ color: TEXT_MUTED }}>
                    {Object.entries(item.option_json)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </p>
                )}
                <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
                  {formatPrice(item.product.sale_price || item.product.base_price)}원 × {item.quantity}개
                </p>
                <p className="mt-0.5 text-sm font-bold" style={{ color: TEXT }}>
                  {formatPrice(getItemPrice(item))}원
                </p>
              </div>
            </li>
          ))}
          </ul>
        </div>
      </section>

      <SectionDivider />

      {/* (4) 결제 수단 선택 섹션 - 주문상품 다음 배치 */}
      <section className="py-4">
        <h2 className="mb-3 text-base font-bold" style={{ color: TEXT }}>
          결제 수단
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "card", label: "카드결제" },
            { value: "transfer", label: "무통장입금" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-3 transition-colors ${
                paymentMethod === opt.value ? "ring-2" : ""
              }`}
              style={{
                borderColor: paymentMethod === opt.value ? PRIMARY : BORDER,
                backgroundColor: paymentMethod === opt.value ? PRIMARY_LIGHT : "white",
              }}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={opt.value}
                checked={paymentMethod === opt.value}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="accent-[#D6A8E0]"
              />
              <span className="text-sm font-medium" style={{ color: TEXT }}>
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );

  const PaymentSummary = (
    <section
      className="rounded-2xl p-5 lg:sticky lg:top-24"
      style={{ backgroundColor: PAYMENT_BG, borderRadius: CARD_RADIUS }}
    >
      <h2 className="mb-4 text-base font-bold" style={{ color: TEXT }}>
        결제 금액
      </h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span style={{ color: TEXT_MUTED }}>상품 합계</span>
          <span style={{ color: TEXT }}>{formatPrice(paymentLineProductSum)}원</span>
        </div>
        <div
          className="flex items-center justify-between gap-4 border-t pt-4 mt-4"
          style={{ borderColor: BORDER }}
        >
          <span className="text-base font-bold" style={{ color: TEXT }}>
            총 결제금액
          </span>
          <span className="text-2xl font-extrabold shrink-0" style={{ color: ACCENT_DARK }}>
            {formatPrice(displayPayTotal)}원
          </span>
        </div>
      </div>
    </section>
  );

  const guestModeUi = isGuestCheckout && !session?.user?.id;

  return (
    <OrderGuard
      partnerId={partnerId}
      shopClientId={clientId ?? undefined}
      shopClientName={template?.client?.name ?? undefined}
      requireAuth={!isGuestCheckout}
      blockAffiliationMismatch={!isGuestCheckout}
    >
      <form onSubmit={handleSubmit} className="checkout-tunnel-form mx-auto min-h-screen min-h-[100dvh] max-w-[430px] bg-white pb-36 lg:max-w-6xl lg:px-6 lg:pb-40">
        <div className="px-4 py-4 lg:py-6">
          {pendingOrderId && pendingPrepareSnapshot && (
            <div
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
              role="status"
            >
              결제창을 불러오지 못했습니다. 주문번호 {pendingPrepareSnapshot.orderNo}. 아래{" "}
              <strong>결제하기</strong>를 다시 눌러 주세요.
            </div>
          )}
          {isCheckoutTestDefaultsEnabled() && guestModeUi && (
            <div
              className="mb-4 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-medium text-amber-950"
              role="status"
            >
              테스트 모드: 결제 연습용 기본값이 채워져 있습니다. 오픈 전
              NEXT_PUBLIC_ENABLE_CHECKOUT_TEST_DEFAULTS 를 제거(또는 0)하고 재배포하세요.
            </div>
          )}
          {guestModeUi && (
            <section
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4"
              aria-label="비회원 주문 정보"
            >
              <h2 className="mb-3 text-sm font-bold text-amber-900">비회원 주문 정보</h2>
              <p className="mb-3 text-xs text-amber-900/70">
                수령인 정보는 아래 배송지와 동일하게 입력해 주세요.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-amber-900/80">이름</label>
                  <input
                    type="text"
                    inputMode="text"
                    enterKeyHint="next"
                    value={shippingName}
                    onChange={(e) => setShippingName(e.target.value)}
                    onFocus={checkoutFieldFocusScroll}
                    onKeyDown={checkoutInputEnterGoNext}
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                    placeholder="수령인 이름"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-amber-900/80">휴대폰 번호</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    enterKeyHint="next"
                    value={shippingPhone}
                    onChange={(e) => setShippingPhone(e.target.value)}
                    onFocus={checkoutFieldFocusScroll}
                    onKeyDown={checkoutInputEnterGoNext}
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                    placeholder="010-0000-0000"
                    autoComplete="tel"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-amber-900/80">이메일 (결제 안내)</label>
                  <input
                    type="email"
                    enterKeyHint="next"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    onFocus={checkoutFieldFocusScroll}
                    onKeyDown={checkoutInputEnterGoNext}
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
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
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
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
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </section>
          )}
          <div className="lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">
            <div className="lg:col-span-2">{LeftColumn}</div>
            <div className="mt-6 lg:mt-0 lg:col-span-1">{PaymentSummary}</div>
          </div>
        </div>

        {/* Sticky Footer - 개인정보 동의 + [총 결제금액] 결제하기 */}
        <div
          className="fixed left-0 right-0 bottom-0 z-50 mx-auto max-w-[430px] border-t bg-white px-4 py-4 lg:max-w-6xl"
          style={{
            borderColor: BORDER,
            bottom: `calc(env(safe-area-inset-bottom, 0px) + ${stickyAboveNav}px)`,
          }}
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
            disabled={submitting}
            className="w-full rounded-xl py-4 text-base font-bold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: submitting ? "#9CA3AF" : PRIMARY }}
          >
            {`${formatPrice(displayPayTotal)}원 결제하기`}
          </button>
        </div>
      </form>

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

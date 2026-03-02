"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { BOTTOM_NAV_HEIGHT } from "@/components/shop/ShopLayout";

/**
 * 주문서(Checkout) 페이지 - 8대 섹션, 아코디언, 파스텔 연보라 디자인 시스템
 * /{subdomain}/{clientSlug}/checkout
 */

const PRIMARY = "#D6A8E0";
const PRIMARY_LIGHT = "#F3E8F5";
const TEXT = "#333333";
const TEXT_MUTED = "#6B7280";
const DELIVERY_FEE_BLUE = "#2563EB";
const BORDER = "#E5E7EB";
const CARD_RADIUS = "12px";

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
    status: string;
  };
}

interface Address {
  id: string;
  name: string;
  phone: string;
  postcode: string | null;
  address: string;
  detail: string | null;
  is_default: boolean;
}

// 순서: 택배 배송 → 새벽배송 → 퀵배송
const DELIVERY_OPTIONS = [
  { value: "parcel", label: "택배 배송", fee: 4000 },
  { value: "dawn", label: "새벽배송", fee: 3000 },
  { value: "quick", label: "퀵배송", fee: 5000 },
] as const;

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

const SUMMARY_BLUE = "#2563EB";

function Accordion({
  title,
  summary,
  summaryHighlight,
  open,
  onToggle,
  hideBottomBorder,
  children,
}: {
  title: string;
  summary?: string;
  summaryHighlight?: boolean;
  open: boolean;
  onToggle: () => void;
  hideBottomBorder?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={hideBottomBorder ? "" : "border-b border-[#E5E7EB]"}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="text-[15px] font-medium" style={{ color: TEXT }}>
          {title}
        </span>
        <span className="flex items-center gap-2">
          {summary && (
            <span
              className="text-sm"
              style={{ color: summaryHighlight ? SUMMARY_BLUE : TEXT_MUTED, fontWeight: summaryHighlight ? 600 : undefined }}
            >
              {summary}
            </span>
          )}
          {open ? (
            <ChevronUp size={20} style={{ color: TEXT_MUTED }} />
          ) : (
            <ChevronDown size={20} style={{ color: TEXT_MUTED }} />
          )}
        </span>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
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

  // 1. 주문자 정보 (세션에서)
  const ordererName = session?.user?.name ?? "";
  const ordererEmail = (session?.user?.email as string) ?? "";
  const [ordererPhone, setOrdererPhone] = useState("");

  // 2. 상품 수령
  const [deliveryMethod, setDeliveryMethod] = useState<"dawn" | "parcel" | "quick">("parcel");
  const deliveryFee = DELIVERY_OPTIONS.find((o) => o.value === deliveryMethod)?.fee ?? 4000;

  // 3. 배송지
  const [addressTab, setAddressTab] = useState<"recent" | "manual">("manual");
  const [sameAsOrderer, setSameAsOrderer] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingPostcode, setShippingPostcode] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingDetail, setShippingDetail] = useState("");

  // 주문자 정보 아코디언 (기본: 닫힌 상태)
  const [openOrderInfoAccordion, setOpenOrderInfoAccordion] = useState(false);

  // 4. 희망배송일 (기본값: 내일)
  const [deliveryDate, setDeliveryDate] = useState(() => getTomorrowDateString());
  const [openDateAccordion, setOpenDateAccordion] = useState(false);

  // 5. 희망배송시간 (기본값: 14:00~16:00)
  const DEFAULT_TIME_SLOT = "14:00~16:00";
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState(DEFAULT_TIME_SLOT);
  const [openTimeAccordion, setOpenTimeAccordion] = useState(false);

  // 8. 결제 수단
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadItems() {
      if (!clientId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await fetch(`/api/cart?clientId=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        const all = (data.items || []) as CartItem[];
        const filtered =
          selectedItemIds.length > 0
            ? all.filter((item) => selectedItemIds.includes(item.id))
            : all;
        setItems(filtered);
      }
      setLoading(false);
    }
    loadItems();
  }, [clientId, selectedItemIds]);

  // 연락처: Supabase users(프로필)에서 phone 조회
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const res = await fetch("/api/mypage/profile");
      if (res.ok) {
        const data = await res.json();
        const phone = data.user?.phone ?? "";
        setOrdererPhone(phone);
      }
    })();
  }, [session?.user?.id]);

  useEffect(() => {
    async function loadAddresses() {
      const res = await fetch("/api/mypage/addresses");
      if (res.ok) {
        const data = await res.json();
        const list = data.addresses || [];
        setAddresses(list);
        const defaultAddr = list.find((a: Address) => a.is_default) || list[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          setShippingName(defaultAddr.name);
          setShippingPhone(defaultAddr.phone);
          setShippingPostcode(defaultAddr.postcode || "");
          setShippingAddress(defaultAddr.address);
          setShippingDetail(defaultAddr.detail || "");
        }
      }
    }
    loadAddresses();
  }, []);

  const formatPrice = (price: number) => new Intl.NumberFormat("ko-KR").format(price);
  const getItemPrice = (item: CartItem) =>
    (item.product.sale_price || item.product.base_price) * item.quantity;
  const getTotalProductPrice = () => items.reduce((sum, item) => sum + getItemPrice(item), 0);
  const finalTotal = getTotalProductPrice() + deliveryFee;

  const handleSelectAddress = (a: Address) => {
    setSelectedAddressId(a.id);
    setShippingName(a.name);
    setShippingPhone(a.phone);
    setShippingPostcode(a.postcode || "");
    setShippingAddress(a.address);
    setShippingDetail(a.detail || "");
  };

  // 다음(카카오) 주소검색 스크립트 로드 및 열기
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
      alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete(data) {
        setShippingPostcode(data.zonecode || "");
        setShippingAddress(data.address || "");
        setShippingDetail("");
      },
    }).open();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template?.orderAllowed) {
      alert("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
      return;
    }
    if (!partnerId || !clientId || items.length === 0) {
      alert("주문 정보가 올바르지 않습니다.");
      return;
    }
    let name = shippingName;
    let phone = shippingPhone;
    let postcode = shippingPostcode;
    let address = shippingAddress;
    let detail = shippingDetail;
    if (sameAsOrderer) {
      name = ordererName;
      phone = ordererPhone || shippingPhone;
    }
    if (!name || !phone || !address) {
      alert("배송지 정보를 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          paymentMethod,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        alert("주문이 완료되었습니다!\n주문번호: " + data.order.order_no);
        router.push(`/${subdomain}/${clientSlug}`);
      } else {
        const err = await res.json();
        alert(err.error || "주문에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (template == null || !partnerId || !clientId || loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#FAFAFA" }}
      >
        <p style={{ color: TEXT_MUTED }}>로딩 중...</p>
      </div>
    );
  }

  if (items.length === 0) {
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

  return (
    <OrderGuard partnerId={partnerId}>
      <form
        onSubmit={handleSubmit}
        className="mx-auto min-h-screen max-w-[430px] bg-white pb-28"
      >
        <div className="px-4 py-2">
          {/* 1. 주문자 정보 (아코디언) - 하단선은 Accordion 하나만 사용 */}
          <section
            className="rounded-2xl py-2"
            style={{ backgroundColor: "#FAFAFA", borderRadius: CARD_RADIUS }}
          >
            <Accordion
              title="주문자 정보"
              summary={ordererPhone ? `${ordererName || "-"} · ${ordererPhone}` : (ordererName || "이름")}
              open={openOrderInfoAccordion}
              onToggle={() => setOpenOrderInfoAccordion((v) => !v)}
              hideBottomBorder
            >
              <div className="ml-[3px] space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-xs font-medium" style={{ color: TEXT_MUTED, width: "52px" }}>이름</span>
                  <span className="font-medium" style={{ color: TEXT }}>{ordererName || "-"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-xs font-medium" style={{ color: TEXT_MUTED, width: "52px" }}>연락처</span>
                  <input
                    type="tel"
                    value={ordererPhone}
                    onChange={(e) => setOrdererPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full max-w-[180px] rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: BORDER }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-xs font-medium" style={{ color: TEXT_MUTED, width: "52px" }}>이메일</span>
                  <span className="min-w-0 truncate" style={{ color: TEXT }}>{ordererEmail || "-"}</span>
                </div>
              </div>
            </Accordion>
          </section>

          <hr className="my-8 border-gray-200" />

          {/* 2. 상품 수령 */}
          <section className="border-b py-4" style={{ borderColor: BORDER }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: TEXT }}>
              상품 수령
            </h2>
            <div className="space-y-2">
              {DELIVERY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
                  style={{
                    borderColor: deliveryMethod === opt.value ? PRIMARY : BORDER,
                    backgroundColor: deliveryMethod === opt.value ? PRIMARY_LIGHT : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value={opt.value}
                    checked={deliveryMethod === opt.value}
                    onChange={() => setDeliveryMethod(opt.value)}
                    className="h-4 w-4 accent-[#D6A8E0]"
                  />
                  <span className="text-sm font-medium" style={{ color: TEXT }}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-sm font-medium" style={{ color: DELIVERY_FEE_BLUE }}>
              배송비 : {formatPrice(deliveryFee)}원
            </p>
            <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>
              배송 방식에 따라 배송비가 달라질 수 있으며, 제주/도서산간 추가비용이 발생할 수 있습니다.
            </p>
          </section>

          {/* 3. 배송지 (연한 보라 배경으로 시각적 그룹화) */}
          <section className="border-b py-4" style={{ borderColor: BORDER }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: TEXT }}>
              배송지
            </h2>
            <div className="rounded-xl p-4 bg-[#F8F5FF]">
            <div className="mb-3 flex rounded-xl border p-0.5" style={{ borderColor: BORDER }}>
              <button
                type="button"
                onClick={() => setAddressTab("recent")}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: addressTab === "recent" ? "white" : TEXT_MUTED,
                  backgroundColor: addressTab === "recent" ? PRIMARY : "transparent",
                }}
              >
                최근배송지
              </button>
              <button
                type="button"
                onClick={() => setAddressTab("manual")}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: addressTab === "manual" ? "white" : TEXT_MUTED,
                  backgroundColor: addressTab === "manual" ? PRIMARY : "transparent",
                }}
              >
                직접입력
              </button>
            </div>
            <div className="mb-3 flex flex-row flex-wrap items-center justify-center gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="shippingSame"
                  checked={sameAsOrderer}
                  onChange={() => setSameAsOrderer(true)}
                  className="accent-[#D6A8E0]"
                />
                <span className="text-sm" style={{ color: TEXT }}>주문자 정보와 동일</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="shippingSame"
                  checked={!sameAsOrderer}
                  onChange={() => setSameAsOrderer(false)}
                  className="accent-[#D6A8E0]"
                />
                <span className="text-sm" style={{ color: TEXT }}>새로운 배송지</span>
              </label>
            </div>
            {addressTab === "recent" && addresses.length > 0 && (
              <div className="space-y-2">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${
                      selectedAddressId === a.id ? "ring-2" : ""
                    }`}
                    style={{
                      borderColor: selectedAddressId === a.id ? PRIMARY : BORDER,
                      backgroundColor: selectedAddressId === a.id ? PRIMARY_LIGHT : "white",
                    }}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddressId === a.id}
                      onChange={() => handleSelectAddress(a)}
                      className="mt-1 accent-[#D6A8E0]"
                    />
                    <div className="text-sm">
                      <p className="font-medium" style={{ color: TEXT }}>{a.name} {a.phone}</p>
                      <p style={{ color: TEXT_MUTED }}>{a.address} {a.detail || ""}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {addressTab === "manual" && !sameAsOrderer && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: TEXT_MUTED }}>받는 분 *</label>
                  <input
                    type="text"
                    placeholder="받는 분 성함"
                    value={shippingName}
                    onChange={(e) => setShippingName(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 text-sm"
                    style={{ borderColor: BORDER }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: TEXT_MUTED }}>주소</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="우편번호"
                      value={shippingPostcode}
                      onChange={(e) => setShippingPostcode(e.target.value)}
                      className="w-24 rounded-xl border px-3 py-3 text-sm"
                      style={{ borderColor: BORDER }}
                    />
                    <button
                      type="button"
                      onClick={openPostcodeSearch}
                      className="shrink-0 rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
                      style={{ borderColor: PRIMARY, color: PRIMARY }}
                    >
                      주소 검색
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="기본 주소"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-4 py-3 text-sm"
                    style={{ borderColor: BORDER }}
                  />
                  <input
                    type="text"
                    placeholder="상세 주소 (동/호수 등)"
                    value={shippingDetail}
                    onChange={(e) => setShippingDetail(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-4 py-3 text-sm"
                    style={{ borderColor: BORDER }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: TEXT_MUTED }}>휴대전화 *</label>
                  <input
                    type="tel"
                    placeholder="010-0000-0000"
                    value={shippingPhone}
                    onChange={(e) => setShippingPhone(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 text-sm"
                    style={{ borderColor: BORDER }}
                  />
                </div>
              </div>
            )}
            </div>
          </section>

          {/* 4. 희망배송일 (아코디언, 기본값: 내일, 요약 파란색) */}
          <section className="border-b py-2" style={{ borderColor: BORDER }}>
            <Accordion
              title="희망배송일"
              summary={deliveryDate ? deliveryDate.replace(/-/g, ". ") : "선택 안 함"}
              summaryHighlight={!!deliveryDate}
              open={openDateAccordion}
              onToggle={() => setOpenDateAccordion((v) => !v)}
            >
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: BORDER }}>
                <Calendar size={20} style={{ color: PRIMARY }} />
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="flex-1 border-0 bg-transparent py-1 text-sm outline-none"
                  style={{ color: TEXT }}
                />
              </div>
              <p className="mt-2 text-xs" style={{ color: TEXT_MUTED }}>
                희망일을 선택하지 않으면 가능한 빠른 날짜에 배송됩니다.
              </p>
            </Accordion>
          </section>

          {/* 5. 희망배송시간 (아코디언, 기본값: 14:00~16:00, 요약 파란색) */}
          <section className="border-b py-2" style={{ borderColor: BORDER }}>
            <Accordion
              title="희망배송시간"
              summary={deliveryTimeSlot || "선택"}
              summaryHighlight={!!deliveryTimeSlot}
              open={openTimeAccordion}
              onToggle={() => setOpenTimeAccordion((v) => !v)}
            >
              <select
                value={deliveryTimeSlot}
                onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: BORDER, color: TEXT }}
              >
                <option value="">시간대 선택</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </Accordion>
          </section>

          {/* 6. 주문 상품 */}
          <section className="border-b py-4" style={{ borderColor: BORDER }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: TEXT }}>
              주문 상품 ({items.length}개)
            </h2>
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl border p-3"
                  style={{ borderColor: BORDER }}
                >
                  <div
                    className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100"
                  >
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
                    <p className="mt-1 text-sm font-medium" style={{ color: TEXT }}>
                      {formatPrice(item.product.sale_price || item.product.base_price)}원 × {item.quantity}개 = {formatPrice(getItemPrice(item))}원
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* 7. 결제 정보 */}
          <section className="rounded-2xl p-4" style={{ backgroundColor: "#FAFAFA", borderRadius: CARD_RADIUS }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: TEXT }}>
              결제 정보
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: TEXT_MUTED }}>총 상품금액</span>
                <span style={{ color: TEXT }}>{formatPrice(getTotalProductPrice())}원</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: TEXT_MUTED }}>배송비</span>
                <span style={{ color: TEXT }}>{formatPrice(deliveryFee)}원</span>
              </div>
              <div
                className="flex justify-between border-t pt-3"
                style={{ borderColor: BORDER }}
              >
                <span className="text-base font-bold" style={{ color: TEXT }}>
                  최종 결제 금액
                </span>
                <span className="text-xl font-bold" style={{ color: PRIMARY }}>
                  {formatPrice(finalTotal)}원
                </span>
              </div>
            </div>
          </section>

          {/* 8. 결제 수단 */}
          <section className="mt-4 border-b py-4" style={{ borderColor: BORDER }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: TEXT }}>
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
                  <span className="text-sm font-medium" style={{ color: TEXT }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Sticky Footer: 글로벌 하단 네비 바로 위에 고정 */}
        <div
          className="fixed left-0 right-0 mx-auto max-w-[430px] border-t bg-white px-4 py-4"
          style={{
            borderColor: BORDER,
            bottom: `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_NAV_HEIGHT}px)`,
          }}
        >
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl py-4 text-base font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: submitting ? "#9CA3AF" : PRIMARY }}
          >
            {submitting ? "주문 처리 중..." : `${formatPrice(finalTotal)}원 결제하기`}
          </button>
        </div>
      </form>
    </OrderGuard>
  );
}

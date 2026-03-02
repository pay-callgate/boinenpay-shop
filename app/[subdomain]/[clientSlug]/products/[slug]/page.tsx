"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Heart, Share2 } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { BOTTOM_NAV_HEIGHT } from "@/components/shop/ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";
import { addRecentProduct } from "@/lib/recent-products";

/**
 * T4-3: 상품 상세 페이지 (PDP) - Snowfox Flowers 스타일
 * Design: #D6A8E0, #1F2937, #6B7280, #F43F5E, sticky header/bottom, 탭 스크롤 연동
 */

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductOption {
  id: string;
  name: string;
  values: string[];
  price_modifier: number | null;
  sort_order: number;
}

interface GalleryImage {
  id: string;
  image_url: string;
  sort_order: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description_html: string | null;
  thumbnail_url: string | null;
  base_price: number;
  sale_price: number | null;
  stock_qty: number;
  status: string;
  delivery_methods: string[] | null;
  allow_delivery_date: boolean;
  categories: Category[];
  options: ProductOption[];
  gallery: GalleryImage[];
}

const PRIMARY = "#D6A8E0";
const ROSE = "#F43F5E";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const productSlug = params?.slug as string;

  const template = useShopTemplate();
  const partnerId = template?.partner?.id ?? null;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"detail" | "review" | "qna" | "delivery">("detail");
  const [addingToCart, setAddingToCart] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [wishlistChecking, setWishlistChecking] = useState(false);

  const sectionDetailRef = useRef<HTMLDivElement>(null);
  const sectionReviewRef = useRef<HTMLDivElement>(null);
  const sectionQnaRef = useRef<HTMLDivElement>(null);
  const sectionDeliveryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchProduct() {
      if (!partnerId || !productSlug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await shopFetch(`/api/shop/products/${productSlug}?partnerId=${partnerId}`);
        if (res.ok) {
          const data = await res.json();
          const prod = data?.product ?? null;
          setProduct(prod);
          if (prod?.options?.length) {
            const defaultOptions: Record<string, string> = {};
            prod.options.forEach((opt: ProductOption) => {
              if (opt.values?.length) defaultOptions[opt.id] = opt.values[0];
            });
            setSelectedOptions(defaultOptions);
          }
          if (prod?.id && subdomain && clientSlug) {
            addRecentProduct(subdomain, clientSlug, {
              id: prod.id,
              name: prod.name,
              slug: prod.slug,
              thumbnail_url: prod.thumbnail_url ?? null,
              base_price: Number(prod.base_price) || 0,
              sale_price: prod.sale_price != null ? Number(prod.sale_price) : null,
              status: prod.status ?? "active",
            });
          }
          const clientIdCookie = document.cookie
            .split("; ")
            .find((row) => row.startsWith("client_source_id="))
            ?.split("=")[1];
          if (clientIdCookie && prod?.id) {
            shopFetch("/api/mypage/product-views", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId: prod.id, clientId: clientIdCookie }),
            }).catch(() => {});
          }
        } else {
          setProduct(null);
        }
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [partnerId, productSlug]);

  const clientId = template?.client?.id ?? null;
  useEffect(() => {
    if (!clientId || !product?.id) return;
    let cancelled = false;
    shopFetch(`/api/mypage/wishlist?clientId=${clientId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const items = data?.items ?? [];
        setIsInWishlist(items.some((i: { product: { id: string } }) => i.product?.id === product?.id));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [clientId, product?.id]);

  const addToWishlist = async () => {
    if (!product?.id || !clientId) {
      alert("로그인 후 이용해 주세요.");
      return;
    }
    setWishlistChecking(true);
    try {
      const res = await shopFetch("/api/mypage/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, clientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIsInWishlist(true);
        setShowWishlistModal(true);
      } else if (data.message?.includes("이미")) {
        setIsInWishlist(true);
      } else {
        alert(data.error || "관심상품 담기에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setWishlistChecking(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ko-KR").format(price);

  const getDiscountRate = (basePrice: number, salePrice: number | null) => {
    if (!salePrice || salePrice >= basePrice) return null;
    return Math.round(((basePrice - salePrice) / basePrice) * 100);
  };

  const getFinalPrice = () => {
    if (!product) return 0;
    let price = product.sale_price || product.base_price;
    product.options?.forEach((opt) => {
      if (opt?.price_modifier != null && selectedOptions[opt.id])
        price += opt.price_modifier;
    });
    return price * quantity;
  };

  const addToCart = async () => {
    if (!product) return;
    if (!template?.orderAllowed) {
      alert("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
      return;
    }
    const clientIdCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("client_source_id="))
      ?.split("=")[1];
    if (!clientIdCookie) {
      alert("거래처 정보를 찾을 수 없습니다.");
      return;
    }
    setAddingToCart(true);
    try {
      const res = await shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientIdCookie,
          productId: product.id,
          optionJson: Object.keys(selectedOptions).length > 0 ? selectedOptions : null,
          quantity,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
        alert(data.message || "장바구니에 추가되었습니다.");
      } else {
        const err = await res.json();
        alert(err.error || "장바구니 추가에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setAddingToCart(false);
    }
  };

  const goToBuyNow = async () => {
    if (!product) return;
    if (!template?.orderAllowed) {
      alert("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
      return;
    }
    const clientIdCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("client_source_id="))
      ?.split("=")[1];
    if (!clientIdCookie) {
      alert("거래처 정보를 찾을 수 없습니다.");
      return;
    }
    setAddingToCart(true);
    try {
      const res = await shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientIdCookie,
          productId: product.id,
          optionJson: Object.keys(selectedOptions).length > 0 ? selectedOptions : null,
          quantity,
        }),
      });
      if (res.ok) {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
        router.push(`/${subdomain}/${clientSlug}/checkout`);
        return;
      }
      const err = await res.json();
      alert(err.error ?? "장바구니 추가에 실패했습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setAddingToCart(false);
    }
  };

  const scrollToSection = (key: "detail" | "review" | "qna" | "delivery") => {
    setActiveTab(key);
    const ref =
      key === "detail"
        ? sectionDetailRef
        : key === "review"
          ? sectionReviewRef
          : key === "qna"
            ? sectionQnaRef
            : sectionDeliveryRef;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const images =
    product?.gallery?.length
      ? product.gallery.map((g) => g.image_url)
      : product?.thumbnail_url
        ? [product.thumbnail_url]
        : [];

  if (template == null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-gray-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }
  if (!partnerId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-gray-50 px-4">
        <p className="text-center text-gray-600">파트너 정보를 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/${clientSlug}`)}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          홈으로
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-gray-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <h1 className="text-xl font-medium text-gray-900">상품을 찾을 수 없습니다</h1>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/${clientSlug}/products`)}
          className="mt-4 rounded-lg px-6 py-3 text-sm font-medium text-white active:opacity-90"
          style={{ backgroundColor: PRIMARY }}
        >
          상품 목록으로
        </button>
      </div>
    );
  }

  const isSoldOut = product.status === "sold_out";
  const discountRate = getDiscountRate(product.base_price, product.sale_price);
  const salePrice = product.sale_price ?? product.base_price;

  return (
    <OrderGuard partnerId={partnerId ?? undefined}>
      <div className="mx-auto max-w-[430px] min-h-screen bg-white tracking-tight">
        {/* Hero 이미지: 뷰포트 기반 높이(45vh, max 400px), 모바일 Above the Fold 최적화 */}
        <div className="relative h-[45vh] max-h-[400px] w-full bg-gray-100">
          {images.length > 0 ? (
            <>
              <img
                src={images[currentImageIndex]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
              {isSoldOut && (
                <div
                  className="absolute right-4 top-4 rounded-md px-3 py-1.5 text-sm font-bold text-white"
                  style={{ backgroundColor: "#6B7280" }}
                >
                  SOLD OUT
                </div>
              )}
              {images.length > 1 && (
                <>
                  <div
                    className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white"
                  >
                    {currentImageIndex + 1} / {images.length}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentImageIndex((p) => (p === 0 ? images.length - 1 : p - 1))
                    }
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/50 active:opacity-90"
                  >
                    <ChevronLeft strokeWidth={2} className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentImageIndex((p) => (p === images.length - 1 ? 0 : p + 1))
                    }
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/50 active:opacity-90"
                  >
                    <ChevronRight strokeWidth={2} className="h-5 w-5" />
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              No Image
            </div>
          )}
        </div>

        {/* (3) 상품 정보: 타이틀, 가격, 하트/공유 (컴팩트) */}
        <section className="px-5 py-4">
          <h1 className="text-xl font-medium leading-snug text-gray-900">
            {product.name}
          </h1>
          {product.short_description && (
            <p className="mt-0.5 text-sm text-gray-500">{product.short_description}</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              {discountRate != null && discountRate > 0 && (
                <span className="text-xl font-bold" style={{ color: ROSE }}>
                  {discountRate}%
                </span>
              )}
              <span className="text-xl font-bold text-gray-900">
                {formatPrice(salePrice)}원
              </span>
              {product.sale_price != null && product.sale_price < product.base_price && (
                <span className="text-sm text-gray-400 line-through">
                  {formatPrice(product.base_price)}원
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <button
                type="button"
                onClick={addToWishlist}
                disabled={wishlistChecking}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 active:opacity-80 disabled:opacity-50"
                aria-label="찜"
              >
                <Heart
                  strokeWidth={1.5}
                  className="h-5 w-5"
                  fill={isInWishlist ? ROSE : "none"}
                  style={{ color: isInWishlist ? ROSE : undefined }}
                />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 active:opacity-80"
                aria-label="공유"
              >
                <Share2 strokeWidth={1.5} className="h-5 w-5" />
              </button>
            </div>
          </div>
          {isSoldOut && (
            <div className="mt-2 rounded-lg bg-red-50 px-4 py-2">
              <p className="text-sm font-medium text-rose-500">품절된 상품입니다.</p>
            </div>
          )}
        </section>

        {/* 구분선 */}
        <div className="h-1.5 bg-gray-50" />

        {/* (4) 배송 및 혜택 정보 (컴팩트) */}
        <section className="border-t border-gray-100 py-3">
          <div className="flex gap-2 px-5">
            <span className="w-16 shrink-0 text-sm font-medium text-gray-900">배송</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-sm bg-purple-50 px-1.5 py-0.5 text-[11px] font-medium text-purple-700">
                  새벽배송
                </span>
                <span className="rounded-sm bg-purple-50 px-1.5 py-0.5 text-[11px] font-medium text-purple-700">
                  전국택배
                </span>
              </div>
              <p className="mt-1.5 text-sm text-gray-600">
                서울/경기 밤 11시 전 주문 시 내일 아침 7시 전 도착
              </p>
            </div>
          </div>
        </section>

        {/* 구분선 */}
        <div className="h-1.5 bg-gray-50" />

        {/* (5) 옵션 선택 (컴팩트) */}
        {product.options?.length ? (
          <section className="px-5 py-3">
            <h3 className="mb-2 text-sm font-medium text-gray-900">옵션 선택</h3>
            <div className="space-y-2">
              {(product.options ?? []).map((opt) => (
                <select
                  key={opt.id}
                  value={selectedOptions[opt.id] ?? ""}
                  onChange={(e) =>
                    setSelectedOptions((prev) => ({ ...prev, [opt.id]: e.target.value }))
                  }
                  disabled={isSoldOut}
                  className="h-12 w-full rounded-none border border-gray-200 px-4 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {(opt.values ?? []).map((val, i) => (
                    <option key={i} value={val}>
                      {val}
                      {opt.price_modifier != null && opt.price_modifier > 0
                        ? ` (+${formatPrice(opt.price_modifier)}원)`
                        : ""}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </section>
        ) : null}

        {/* 수량 (컴팩트) */}
        <section className="border-t border-gray-100 px-5 py-3">
          <h3 className="mb-2 text-sm font-medium text-gray-900">수량</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-200">
              <button
                type="button"
                onClick={() => setQuantity((p) => Math.max(1, p - 1))}
                disabled={isSoldOut}
                className="flex h-11 w-11 items-center justify-center text-gray-600 hover:bg-gray-50 active:opacity-80 disabled:opacity-50"
              >
                −
              </button>
              <span className="flex h-11 min-w-[3rem] items-center justify-center border-x border-gray-200 text-sm font-medium text-gray-900">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((p) => p + 1)}
                disabled={isSoldOut}
                className="flex h-11 w-11 items-center justify-center text-gray-600 hover:bg-gray-50 active:opacity-80 disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>
        </section>

        {/* 총 금액 (컴팩트) */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-3">
          <span className="text-sm font-medium text-gray-900">총 금액</span>
          <span className="text-lg font-bold text-gray-900">
            {formatPrice(getFinalPrice())}원
          </span>
        </div>

        {/* 구분선 */}
        <div className="h-2 bg-gray-50" />

        {/* (6) Sticky 탭: 상세정보, 후기, Q&A, 배송안내 */}
        <div className="sticky top-14 z-40 h-12 border-b border-gray-200 bg-white">
          <div className="flex h-full">
            {[
              { key: "detail" as const, label: "상세정보" },
              { key: "review" as const, label: "후기(0)" },
              { key: "qna" as const, label: "Q&A" },
              { key: "delivery" as const, label: "배송안내" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => scrollToSection(tab.key)}
                className={`flex-1 text-sm transition-colors ${
                  activeTab === tab.key
                    ? "font-bold text-purple-700 border-b-2 border-purple-700"
                    : "text-gray-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* (7) 상세 콘텐츠 (탭별 스크롤 타겟) */}
        <div ref={sectionDetailRef} className="px-0">
          <div className="py-6 px-5">
            {product.description_html ? (
              <div
                className="leading-relaxed text-gray-700 [&_img]:w-full [&_img]:h-auto"
                dangerouslySetInnerHTML={{ __html: product.description_html }}
              />
            ) : (
              <p className="text-gray-500">상세 정보가 없습니다.</p>
            )}
          </div>
        </div>

        <div className="h-2 bg-gray-50" />

        <div ref={sectionReviewRef} className="py-8 text-center">
          <p className="text-sm text-gray-500">후기가 없습니다.</p>
        </div>

        <div className="h-2 bg-gray-50" />

        <div ref={sectionQnaRef} className="py-8 text-center">
          <p className="text-sm text-gray-500">문의가 없습니다.</p>
        </div>

        <div className="h-2 bg-gray-50" />

        <div ref={sectionDeliveryRef} className="py-8 px-5">
          <p className="text-sm leading-relaxed text-gray-600">
            배송 안내 내용입니다. 새벽배송, 전국 택배 등 안내를 입력할 수 있습니다.
          </p>
        </div>

        {/* 하단 구매 바: 글로벌 하단 네비 바로 위에 고정 */}
        <div
          className="fixed left-0 right-0 z-50 border-t border-gray-200 bg-white"
          style={{
            bottom: `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_NAV_HEIGHT}px)`,
          }}
        >
          <div className="mx-auto flex h-14 max-w-[430px]">
          <button
            type="button"
            onClick={addToWishlist}
            disabled={wishlistChecking}
            className="flex w-14 shrink-0 items-center justify-center border-r border-gray-200 bg-white text-gray-500 hover:bg-gray-50 active:opacity-80 disabled:opacity-50"
            aria-label="찜"
          >
            <Heart
              strokeWidth={1.5}
              className="h-6 w-6"
              fill={isInWishlist ? ROSE : "none"}
              style={{ color: isInWishlist ? ROSE : undefined }}
            />
          </button>
          <button
            type="button"
            disabled={isSoldOut || addingToCart}
            onClick={addToCart}
            className="flex flex-1 items-center justify-center border-r border-gray-200 bg-white text-base font-medium text-gray-900 hover:bg-gray-50 active:opacity-90 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {isSoldOut ? "품절" : addingToCart ? "추가 중..." : "장바구니"}
          </button>
          <button
            type="button"
            disabled={isSoldOut}
            onClick={goToBuyNow}
            className="flex flex-1 items-center justify-center text-lg font-medium text-white active:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed"
            style={{ backgroundColor: isSoldOut ? undefined : PRIMARY }}
          >
            {isSoldOut ? "품절" : "구매하기"}
          </button>
          </div>
        </div>

        {/* 하단 네비 + CTA 바 높이만큼 패딩 */}
        <div style={{ height: BOTTOM_NAV_HEIGHT + 56 }} />
      </div>

      {/* 관심상품담기 모달 — 브랜드 컬러(PRIMARY) 및 쇼핑몰 표준 버튼 스타일 */}
      {showWishlistModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wishlist-modal-title"
        >
          <div className="w-full max-w-[340px] rounded-xl overflow-hidden bg-white shadow-xl">
            <header
              className="flex items-center justify-between px-5 py-4 text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              <h2 id="wishlist-modal-title" className="text-lg font-bold">
                관심상품담기
              </h2>
              <button
                type="button"
                onClick={() => setShowWishlistModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20 active:opacity-80"
                aria-label="닫기"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </header>
            <div className="px-5 py-8 text-center">
              <Heart
                fill={PRIMARY}
                stroke={PRIMARY}
                strokeWidth={1.5}
                className="mx-auto mb-4 h-14 w-14"
              />
              <p className="text-[15px] leading-relaxed text-gray-700">
                선택하신 상품을 관심상품에 담았습니다.
                <br />
                지금 관심상품을 확인하시겠습니까?
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-6">
              <button
                type="button"
                onClick={() => {
                  setShowWishlistModal(false);
                  router.push(`/${subdomain}/${clientSlug}/mypage/wishlist`);
                }}
                className="flex-1 rounded-lg py-3.5 text-lg font-medium text-white active:opacity-90"
                style={{ backgroundColor: PRIMARY }}
              >
                관심상품 확인
              </button>
              <button
                type="button"
                onClick={() => setShowWishlistModal(false)}
                className="flex-1 rounded-lg border border-gray-300 py-3.5 text-lg font-medium text-gray-700 hover:bg-gray-50 active:opacity-90"
              >
                쇼핑 계속하기
              </button>
            </div>
          </div>
        </div>
      )}
    </OrderGuard>
  );
}

"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Gift, Heart, Share2, ShoppingCart } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import {
  ShopPurchaseBlockModal,
  type ShopPurchaseBlockReason,
} from "@/components/shop/ShopPurchaseBlockModal";
import { useUserClient } from "@/hooks/useUserClient";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { BOTTOM_NAV_HEIGHT } from "@/components/shop/ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";
import { addRecentProduct } from "@/lib/recent-products";
import { getShopRelativeReturnPath } from "@/lib/shop-callback-url";
import {
  effectiveGuestUnitPrice,
  effectiveMemberUnitPrice,
} from "@/lib/product-pricing";

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
  member_price?: number | null;
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
  const searchParams = useSearchParams();
  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const productSlug = params?.slug as string;
  const memberBuy = searchParams?.get("memberBuy") === "1";

  const template = useShopTemplate();
  const partnerId = template?.partner?.id ?? null;
  const { data: session, status: sessionStatus } = useSession();
  const { userClients, loading: userClientLoading } = useUserClient(partnerId ?? undefined);

  const [purchaseBlockOpen, setPurchaseBlockOpen] = useState(false);
  const [purchaseBlockReason, setPurchaseBlockReason] =
    useState<ShopPurchaseBlockReason>("login");

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"detail" | "review" | "qna" | "delivery">("detail");
  const [addingToCart, setAddingToCart] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [wishlistChecking, setWishlistChecking] = useState(false);

  const sectionDetailRef = useRef<HTMLDivElement>(null);
  const sectionReviewRef = useRef<HTMLDivElement>(null);
  const sectionQnaRef = useRef<HTMLDivElement>(null);
  const sectionDeliveryRef = useRef<HTMLDivElement>(null);
  const memberBuyHandledRef = useRef(false);

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
          const mallCid = template?.client?.id;
          if (mallCid && prod?.id && subdomain && clientSlug) {
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

  // 조회수 기록: 로그인 확인된 경우에만 호출. 비로그인 탐색과 충돌 방지 + 401 시에도 전역 세션 만료 UX 금지
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !product?.id) return;
    const clientIdCookie =
      typeof document !== "undefined"
        ? document.cookie
            .split("; ")
            .find((row) => row.startsWith("client_source_id="))
            ?.split("=")[1]
        : undefined;
    const viewClientId = clientId ?? clientIdCookie;
    if (!viewClientId) return;
    shopFetch("/api/mypage/product-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        clientId: viewClientId,
      }),
      handleSessionExpiry: false,
    }).catch(() => {
      /* 401 등 — 상세 탐색 UX 방해 없음 */
    });
  }, [sessionStatus, product?.id, clientId]);

  useEffect(() => {
    // 비로그인 시 관심상품 API는 401 → shopFetch가 전역 로그아웃·로그인 이동을 트리거함
    if (sessionStatus !== "authenticated" || !clientId || !product?.id) return;
    let cancelled = false;
    shopFetch(`/api/mypage/wishlist?clientId=${clientId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const items = (data?.items ?? []) as { id: string; product: { id: string } }[];
        const found = items.find((i) => i.product?.id === product?.id);
        setIsInWishlist(!!found);
        setWishlistItemId(found?.id ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sessionStatus, clientId, product?.id]);

  useEffect(() => {
    if (!memberBuy) memberBuyHandledRef.current = false;
  }, [memberBuy]);

  /** 로그인 후 회원가 구매 콜백: 장바구니 담고 결제창으로 이동 */
  useEffect(() => {
    if (!memberBuy || !product || sessionStatus !== "authenticated" || !clientId) return;
    if (!template?.orderAllowed) return;
    const optionsReady =
      !product.options?.length ||
      product.options.every((o) => Boolean(selectedOptions[o.id]));
    if (!optionsReady) return;
    if (memberBuyHandledRef.current) return;
    memberBuyHandledRef.current = true;
    let cancelled = false;
    (async () => {
      const res = await shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          productId: product.id,
          optionJson: Object.keys(selectedOptions).length > 0 ? selectedOptions : null,
          quantity,
        }),
      });
      if (cancelled) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error ?? "장바구니 추가에 실패했습니다.", "error");
        memberBuyHandledRef.current = false;
        return;
      }
      const data = await res.json().catch(() => ({}));
      const cartItemId = data?.cartItem?.id as string | undefined;
      if (!cartItemId) {
        memberBuyHandledRef.current = false;
        return;
      }
      router.replace(`/${subdomain}/${clientSlug}/checkout?items=${encodeURIComponent(cartItemId)}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    memberBuy,
    product,
    sessionStatus,
    clientId,
    subdomain,
    clientSlug,
    template?.orderAllowed,
    selectedOptions,
    quantity,
    router,
  ]);

  const optionExtra = useMemo(() => {
    if (!product) return 0;
    let ex = 0;
    product.options?.forEach((opt) => {
      if (opt?.price_modifier != null && selectedOptions[opt.id]) {
        ex += opt.price_modifier;
      }
    });
    return ex;
  }, [product, selectedOptions]);

  const guestUnitTotal = useMemo(() => {
    if (!product) return 0;
    return (effectiveGuestUnitPrice(product) + optionExtra) * quantity;
  }, [product, optionExtra, quantity]);

  const memberUnitTotal = useMemo(() => {
    if (!product) return 0;
    return (effectiveMemberUnitPrice(product) + optionExtra) * quantity;
  }, [product, optionExtra, quantity]);

  const tryPurchaseOrWishlistAction = (): boolean => {
    if (!clientId) {
      toast("거래처 정보를 불러올 수 없습니다.");
      return false;
    }
    if (
      sessionStatus === "loading" ||
      (sessionStatus === "authenticated" && userClientLoading)
    ) {
      toast("잠시만 기다려 주세요.");
      return false;
    }
    if (sessionStatus === "unauthenticated") {
      setPurchaseBlockReason("login");
      setPurchaseBlockOpen(true);
      return false;
    }
    if (userClients.length === 0) {
      setPurchaseBlockReason("needClient");
      setPurchaseBlockOpen(true);
      return false;
    }
    if (!userClients.some((uc) => uc.client_id === clientId)) {
      setPurchaseBlockReason("affiliation");
      setPurchaseBlockOpen(true);
      return false;
    }
    return true;
  };

  const addToWishlist = async () => {
    if (!product?.id || !clientId) {
      toast("거래처 정보를 불러올 수 없습니다.");
      return;
    }
    if (!tryPurchaseOrWishlistAction()) return;
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
        toast(data.error || "관심상품 담기에 실패했습니다.", "error");
        setWishlistChecking(false);
        return;
      }
      const listRes = await shopFetch(`/api/mypage/wishlist?clientId=${clientId}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const items = (listData?.items ?? []) as { id: string; product: { id: string } }[];
        const item = items.find((i) => i.product?.id === product.id);
        if (item) setWishlistItemId(item.id);
      }
    } catch {
      toast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setWishlistChecking(false);
    }
  };

  const removeFromWishlist = async () => {
    if (!wishlistItemId) return;
    setWishlistChecking(true);
    try {
      const res = await shopFetch(`/api/mypage/wishlist/${wishlistItemId}`, { method: "DELETE" });
      if (res.ok) {
        setIsInWishlist(false);
        setWishlistItemId(null);
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err?.error || "관심상품에서 삭제에 실패했습니다.", "error");
      }
    } catch {
      toast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setWishlistChecking(false);
    }
  };

  const toggleWishlist = () => {
    if (isInWishlist) removeFromWishlist();
    else addToWishlist();
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

  const canGuestShop = () => {
    if (!clientId) {
      toast("거래처 정보를 불러올 수 없습니다.");
      return false;
    }
    if (!template?.orderAllowed) {
      toast("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
      return false;
    }
    if (sessionStatus === "loading") {
      toast("잠시만 기다려 주세요.");
      return false;
    }
    return true;
  };

  const addToCart = async () => {
    if (!product) return;
    if (!canGuestShop()) return;
    if (sessionStatus === "authenticated" && !tryPurchaseOrWishlistAction()) return;
    setAddingToCart(true);
    try {
      const res = await shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          productId: product.id,
          optionJson: Object.keys(selectedOptions).length > 0 ? selectedOptions : null,
          quantity,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
        toast(data.message || "장바구니에 추가되었습니다.", "success");
      } else {
        const err = await res.json();
        toast(err.error || "장바구니 추가에 실패했습니다.", "error");
      }
    } catch {
      toast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setAddingToCart(false);
    }
  };

  const goToGuestCheckout = async () => {
    if (!product) return;
    if (!canGuestShop()) return;
    /** 비회원가: 전용몰 미소속 로그인 사용자도 게스트 장바구니로 담아야 하므로 소속 검사 생략 */
    setAddingToCart(true);
    try {
      const res = await shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          productId: product.id,
          optionJson: Object.keys(selectedOptions).length > 0 ? selectedOptions : null,
          quantity,
          forceGuestCart: true,
        }),
      });
      if (res.ok) {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
        const data = await res.json();
        const cartItemId = data?.cartItem?.id as string | undefined;
        if (!cartItemId) return;
        router.push(
          `/${subdomain}/${clientSlug}/guest-order?items=${encodeURIComponent(cartItemId)}`
        );
        return;
      }
      const err = await res.json();
      toast(err.error ?? "장바구니 추가에 실패했습니다.", "error");
    } catch {
      toast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setAddingToCart(false);
    }
  };

  const goToMemberCheckout = async () => {
    if (!product) return;
    if (!canGuestShop()) return;
    if (sessionStatus !== "authenticated") {
      const callbackUrl = `/${subdomain}/${clientSlug}/products/${productSlug}?memberBuy=1`;
      router.push(`/${subdomain}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    if (!tryPurchaseOrWishlistAction()) return;
    setAddingToCart(true);
    try {
      const res = await shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          productId: product.id,
          optionJson: Object.keys(selectedOptions).length > 0 ? selectedOptions : null,
          quantity,
        }),
      });
      if (res.ok) {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
        const data = await res.json();
        const cartItemId = data?.cartItem?.id as string | undefined;
        if (!cartItemId) return;
        router.push(`/${subdomain}/${clientSlug}/checkout?items=${encodeURIComponent(cartItemId)}`);
        return;
      }
      const err = await res.json();
      toast(err.error ?? "장바구니 추가에 실패했습니다.", "error");
    } catch {
      toast("네트워크 오류가 발생했습니다.", "error");
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
        <p className="text-gray-500"></p>
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
        <p className="text-gray-500"></p>
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
  const compareMemberUnit = effectiveMemberUnitPrice(product);

  const regClient = userClients[0]?.clients;

  return (
    <OrderGuard
      partnerId={partnerId ?? undefined}
      shopClientId={clientId ?? undefined}
      shopClientName={template?.client?.name ?? undefined}
      requireAuth={false}
      blockAffiliationMismatch={false}
    >
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
          <div className="mt-2 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
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
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-sm font-bold text-purple-700">
                  🎁 회원특별가(로그인 시) {formatPrice(compareMemberUnit)}원
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-gray-400">
              <button
                type="button"
                onClick={toggleWishlist}
                disabled={wishlistChecking}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 active:opacity-80 disabled:opacity-50"
                aria-label="찜"
              >
                <Heart
                  strokeWidth={1.5}
                  className="h-5 w-5"
                  fill={isInWishlist ? PRIMARY : "none"}
                  style={{ color: isInWishlist ? PRIMARY : undefined }}
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
                <span className="rounded-sm px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "#F8F5FF", color: PRIMARY }}>
                  새벽배송
                </span>
                <span className="rounded-sm px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "#F8F5FF", color: PRIMARY }}>
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
                  className="h-12 w-full rounded-none border border-gray-200 px-4 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#D6A8E0]/40 disabled:bg-gray-50 disabled:text-gray-400"
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
                  activeTab === tab.key ? "font-bold border-b-2" : "text-gray-500"
                }`}
                style={activeTab === tab.key ? { color: PRIMARY, borderBottomColor: PRIMARY } : undefined}
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

        {/* 하단 1-Depth 액션 바: ♡ | 장바구니 | 비회원가 | 회원가 */}
        <div
          className="fixed left-0 right-0 z-50 border-t border-gray-200 bg-white"
          style={{
            bottom: `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_NAV_HEIGHT}px)`,
          }}
        >
          <div className="mx-auto grid max-w-[430px] grid-cols-[48px_48px_1fr_1fr] items-stretch gap-0 min-h-[56px]">
            <button
              type="button"
              onClick={toggleWishlist}
              disabled={wishlistChecking}
              className="flex items-center justify-center border-r border-gray-200 bg-white text-gray-500 hover:bg-gray-50 active:opacity-80 disabled:opacity-50"
              aria-label="찜"
            >
              <Heart
                strokeWidth={1.5}
                className="h-6 w-6"
                fill={isInWishlist ? PRIMARY : "none"}
                style={{ color: isInWishlist ? PRIMARY : undefined }}
              />
            </button>
            <button
              type="button"
              disabled={isSoldOut || addingToCart}
              onClick={addToCart}
              className="flex items-center justify-center border-r border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:opacity-90 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              aria-label="장바구니 담기"
            >
              <ShoppingCart strokeWidth={1.5} className="h-6 w-6" />
            </button>
            <button
              type="button"
              disabled={isSoldOut || addingToCart}
              onClick={goToGuestCheckout}
              className="flex min-w-0 flex-col items-center justify-center border-r border-gray-200 bg-white px-1 py-2 text-center active:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-[10px] font-medium leading-tight text-gray-500">비회원가</span>
              <span className="truncate text-xs font-bold tabular-nums text-gray-900">
                {isSoldOut ? "품절" : `${formatPrice(guestUnitTotal)}원`}
              </span>
            </button>
            <button
              type="button"
              disabled={isSoldOut || addingToCart}
              onClick={goToMemberCheckout}
              className="flex min-w-0 flex-col items-center justify-center gap-0.5 bg-[#F8F5FF] px-1 py-2 text-center active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: PRIMARY }}
            >
              <span className="flex items-center gap-0.5 text-[10px] font-semibold leading-tight">
                <Gift className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                회원가
              </span>
              <span className="truncate text-xs font-bold tabular-nums">
                {isSoldOut ? "—" : `${formatPrice(memberUnitTotal)}원`}
              </span>
            </button>
          </div>
        </div>

        {/* 하단 네비 + CTA 바 높이만큼 패딩 */}
        <div style={{ height: BOTTOM_NAV_HEIGHT + 64 }} />
      </div>

      {/* 관심상품담기 모달 — 컴팩트 슬림 UI, 브랜드 컬러(PRIMARY) 유지 */}
      {showWishlistModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wishlist-modal-title"
        >
          <div className="w-full max-w-[300px] rounded-xl overflow-hidden bg-white shadow-xl">
            <header
              className="flex items-center justify-between px-4 py-2.5 text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              <h2 id="wishlist-modal-title" className="text-base font-bold">
                관심상품담기
              </h2>
              <button
                type="button"
                onClick={() => setShowWishlistModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20 active:opacity-80"
                aria-label="닫기"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </header>
            <div className="px-4 py-5 text-center">
              <Heart
                fill={PRIMARY}
                stroke={PRIMARY}
                strokeWidth={1.5}
                className="mx-auto mb-3 h-12 w-12"
              />
              <p className="text-sm leading-relaxed text-gray-700">
                선택하신 상품을 관심상품에 담았습니다.
                <br />
                지금 관심상품을 확인하시겠습니까?
              </p>
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => {
                  setShowWishlistModal(false);
                  router.push(`/${subdomain}/${clientSlug}/mypage/wishlist`);
                }}
                className="flex-1 rounded-lg py-2 text-sm font-medium text-white active:opacity-90"
                style={{ backgroundColor: PRIMARY }}
              >
                관심상품 확인
              </button>
              <button
                type="button"
                onClick={() => setShowWishlistModal(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:opacity-90"
              >
                쇼핑 계속하기
              </button>
            </div>
          </div>
        </div>
      )}

      <ShopPurchaseBlockModal
        isOpen={purchaseBlockOpen}
        onClose={() => setPurchaseBlockOpen(false)}
        reason={purchaseBlockReason}
        subdomain={subdomain}
        clientSlug={clientSlug}
        callbackUrl={
          typeof window !== "undefined"
            ? getShopRelativeReturnPath()
            : `/${subdomain}/${clientSlug}/products/${productSlug}`
        }
        shopClientName={template?.client?.name}
        registeredClientName={regClient?.name}
        registeredClientSlug={regClient?.slug}
        userEmail={session?.user?.email ?? null}
      />
    </OrderGuard>
  );
}

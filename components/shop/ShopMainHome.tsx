"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronDown, Heart, ShoppingBag } from "lucide-react";
import { useShopTemplate } from "./ShopTemplateContext";
import type { ShopPartner, ShopClient } from "./ShopLayout";
import { BOTTOM_NAV_HEIGHT, PREVIEW_SLUG } from "./ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "./ToastContext";
import { useUserClient } from "@/hooks/useUserClient";
import {
  ShopPurchaseBlockModal,
  type ShopPurchaseBlockReason,
} from "./ShopPurchaseBlockModal";
import { getShopRelativeReturnPath } from "@/lib/shop-callback-url";

const PRIMARY = "#D6A8E0";

export interface ShopCategory {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
}

export interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  base_price: number;
  sale_price: number | null;
  status: string;
  categories: { id: string; name: string; slug: string }[];
}

export interface ShopMainHomeProps {
  partner: ShopPartner;
  client: ShopClient | null;
  subdomain: string;
  clientSlug: string | null;
  categories: ShopCategory[];
  productsByCategory: Record<string, ShopProduct[]>;
  /** 로딩 중일 때 스켈레톤 표시 (데모 시 "등록된 상품이 없습니다" 플래시 방지) */
  loading?: boolean;
  loadMore?: {
    hasMore: boolean;
    loading: boolean;
    onLoadMore: () => void;
  };
}

function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const slides = [
    { title: "Flowers", subtitle: "꽃", bg: "from-[#E8D5ED] to-[#F5E6F8]" },
    { title: "Best Item", subtitle: "인기 상품", bg: "from-[#F0E6F3] to-[#FDF2F8]" },
  ];

  return (
    <section className="relative w-full overflow-hidden">
      <div
        className="flex transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`flex min-h-[108px] w-full flex-shrink-0 flex-col items-center justify-center bg-gradient-to-br ${slide.bg} px-6 py-5`}
          >
            <h1 className="text-xl font-bold tracking-tight text-[#333333]">
              {slide.title}
            </h1>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">{slide.subtitle}</p>
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-5 opacity-100" : "w-1.5 bg-white/60"
            }`}
            style={{ backgroundColor: i === index ? PRIMARY : undefined }}
            aria-label={`슬라이드 ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("ko-KR").format(price);
}

function getDiscountRate(basePrice: number, salePrice: number | null): number | null {
  if (!salePrice || salePrice >= basePrice) return null;
  return Math.round(((basePrice - salePrice) / basePrice) * 100);
}

/** 글로벌 레이아웃 스크롤 루트(`main` overflow-y-auto) 기준으로 섹션 이동 */
function scrollShopMainToElement(target: HTMLElement, offsetPx = 8) {
  if (typeof document === "undefined") return;
  const main = document.querySelector("main");
  if (!main) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const rootRect = main.getBoundingClientRect();
  const elRect = target.getBoundingClientRect();
  const nextTop = main.scrollTop + (elRect.top - rootRect.top) - offsetPx;
  main.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
}

/** 메인 홈 전용 — 글로벌 레이아웃 서브 경로에는 노출하지 않음 */
function ShopBusinessInfoAccordion() {
  const [isBusinessInfoOpen, setIsBusinessInfoOpen] = useState(false);

  return (
    <footer
      className="border-t border-slate-100 bg-slate-50 px-4 pt-6"
      style={{ paddingBottom: BOTTOM_NAV_HEIGHT + 12 }}
    >
      <button
        type="button"
        onClick={() => setIsBusinessInfoOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-1 rounded-none border-0 bg-transparent py-1.5 text-[13px] font-medium text-slate-500 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
        aria-expanded={isBusinessInfoOpen}
        aria-controls="shop-business-info-panel"
      >
        <span>콜링크 쇼핑 사업자 정보</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ease-out ${
            isBusinessInfoOpen ? "rotate-180" : ""
          }`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      <div
        id="shop-business-info-panel"
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          isBusinessInfoOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-1 px-0.5 pb-1 pt-3 text-center text-[11px] leading-relaxed text-slate-400">
            <p>상호명 : (주)콜게이트</p>
            <p>사업자등록번호 : 211-87-11904</p>
            <p>대표자명 : LEE KANG MIN(이강민)</p>
            <p className="break-keep">
              주소 : 서울시 서초구 효령로77길 28, 8층(서초동, 동오빌딩)
            </p>
            <p>전화번호 : 02-529-2170</p>
            <p>이메일 : info@callgate.com</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ShopMainHomeWithCategoryUrl({
  partner,
  client,
  subdomain,
  clientSlug,
  categories,
  productsByCategory,
  loading,
  loadMore,
}: ShopMainHomeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCategorySlug = searchParams.get("category");
  const { data: session, status: sessionStatus } = useSession();
  const shop = useShopTemplate();
  const clientId = shop?.client?.id ?? null;
  const { userClients, loading: userClientLoading } = useUserClient(partner.id);
  const [purchaseBlockOpen, setPurchaseBlockOpen] = useState(false);
  const [purchaseBlockReason, setPurchaseBlockReason] =
    useState<ShopPurchaseBlockReason>("login");
  const slugForPath = clientSlug ?? PREVIEW_SLUG;

  const tryMallPurchaseAction = useCallback((): boolean => {
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
  }, [clientId, sessionStatus, userClientLoading, userClients]);

  const [wishlistProductIds, setWishlistProductIds] = useState<Set<string>>(new Set());
  const [wishlistItemIdsByProductId, setWishlistItemIdsByProductId] = useState<Record<string, string>>({});
  const [addingCartId, setAddingCartId] = useState<string | null>(null);
  const [addingWishlistId, setAddingWishlistId] = useState<string | null>(null);

  // 리프 노드만 노출: 부모 카테고리는 숨기고, 하위 카테고리 + 자식 없는 1차만 표시
  const parentIds = new Set(
    categories.map((c) => c.parent_id).filter(Boolean) as string[]
  );
  const displayCategories = categories.filter((cat) => !parentIds.has(cat.id));
  const basePath = clientSlug
    ? `/${subdomain}/${clientSlug}`
    : `/${subdomain}/${PREVIEW_SLUG}`;
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(null);

  /** URL ?category=slug ↔ 활성 탭 동기화 (모바일 뒤로가기 시에도 마지막 본 카테고리 유지) */
  useEffect(() => {
    if (!displayCategories.length) {
      setActiveCategorySlug(null);
      return;
    }
    const fromUrl = urlCategorySlug?.trim() ?? "";
    const matchSlug =
      fromUrl && displayCategories.some((c) => c.slug === fromUrl) ? fromUrl : null;
    if (fromUrl && !matchSlug) {
      router.replace(basePath, { scroll: false });
      setActiveCategorySlug(displayCategories[0].slug);
      return;
    }
    setActiveCategorySlug(matchSlug ?? displayCategories[0].slug);
  }, [displayCategories, urlCategorySlug, basePath, router]);

  /** 히스토리 복원(bfcache/뒤로가기) 시 선택 카테고리 섹션으로 스크롤 */
  useEffect(() => {
    if (loading) return;
    if (!activeCategorySlug || !urlCategorySlug || urlCategorySlug !== activeCategorySlug) return;
    if (!displayCategories.length) return;
    const cat = displayCategories.find((c) => c.slug === activeCategorySlug);
    if (!cat) return;
    const el = document.getElementById(cat.id);
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }, [loading, activeCategorySlug, urlCategorySlug, displayCategories]);

  // 데스크톱 마우스 드래그 투 스크롤 (useRef로 즉각 반응, 렌더링 딜레이 없음)
  const categoryTabsRef = useRef<HTMLDivElement>(null);
  const isDragMoved = useRef(false);
  const dragRef = useRef({ isDragging: false, startX: 0, startScrollLeft: 0 });

  const handleCategoryTabsMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!categoryTabsRef.current) return;
    isDragMoved.current = false;
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startScrollLeft: categoryTabsRef.current.scrollLeft,
    };
  };

  const handleCategoryTabsMouseLeave = () => {
    dragRef.current.isDragging = false;
  };

  const handleCategoryTabsMouseUp = () => {
    dragRef.current.isDragging = false;
  };

  const handleCategoryTabsMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging || !categoryTabsRef.current) return;
    const el = categoryTabsRef.current;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 5) isDragMoved.current = true;
    const nextScrollLeft = dragRef.current.startScrollLeft - dx;
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollLeft = Math.max(0, Math.min(nextScrollLeft, maxScroll));
  };

  // 관심상품 목록 조회 (로그인한 경우에만 — 비로그인 시 401로 세션 만료 토스트 방지)
  useEffect(() => {
    if (!clientId || sessionStatus !== "authenticated") return;
    shopFetch(`/api/mypage/wishlist?clientId=${clientId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const items = (data?.items ?? []) as { id: string; product: { id: string } }[];
        setWishlistProductIds(new Set(items.map((i) => i.product?.id).filter(Boolean)));
        const byProduct: Record<string, string> = {};
        items.forEach((i) => {
          if (i.product?.id && i.id) byProduct[i.product.id] = i.id;
        });
        setWishlistItemIdsByProductId(byProduct);
      })
      .catch(() => {});
  }, [clientId, sessionStatus]);

  const handleRemoveFromWishlist = useCallback(
    (e: React.MouseEvent, productId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const itemId = wishlistItemIdsByProductId[productId];
      if (!itemId) return;
      setAddingWishlistId(productId);
      shopFetch(`/api/mypage/wishlist/${itemId}`, { method: "DELETE" })
        .then((res) => {
          if (res.ok) {
            setWishlistProductIds((prev) => {
              const next = new Set(prev);
              next.delete(productId);
              return next;
            });
            setWishlistItemIdsByProductId((prev) => {
              const next = { ...prev };
              delete next[productId];
              return next;
            });
          } else {
            return res.json().catch(() => ({})).then((err: { error?: string }) => {
              toast(err?.error || "관심상품에서 삭제에 실패했습니다.", "error");
            });
          }
        })
        .catch(() => toast("네트워크 오류가 발생했습니다.", "error"))
        .finally(() => setAddingWishlistId(null));
    },
    [wishlistItemIdsByProductId]
  );

  const handleAddToWishlist = useCallback(
    (e: React.MouseEvent, productId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!clientId) {
        toast("거래처 정보를 불러올 수 없습니다.");
        return;
      }
      if (!tryMallPurchaseAction()) return;
      setAddingWishlistId(productId);
      shopFetch("/api/mypage/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, clientId }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({})) as { message?: string; error?: string };
          if (res.ok) {
            setWishlistProductIds((prev) => new Set(prev).add(productId));
            if (!data?.message?.includes("이미")) toast("관심상품에 담았습니다.", "success");
          } else if (data?.message?.includes("이미")) {
            setWishlistProductIds((prev) => new Set(prev).add(productId));
          } else {
            toast(data?.error || "관심상품 담기에 실패했습니다.", "error");
            return;
          }
          const listRes = await shopFetch(`/api/mypage/wishlist?clientId=${clientId}`);
          if (listRes.ok) {
            const listData = await listRes.json();
            const items = (listData?.items ?? []) as { id: string; product: { id: string } }[];
            const found = items.find((i) => i.product?.id === productId);
            if (found) {
              setWishlistItemIdsByProductId((prev) => ({ ...prev, [productId]: found.id }));
            }
          }
        })
        .catch(() => toast("네트워크 오류가 발생했습니다.", "error"))
        .finally(() => setAddingWishlistId(null));
    },
    [clientId, tryMallPurchaseAction]
  );

  const toggleWishlist = useCallback(
    (e: React.MouseEvent, productId: string) => {
      if (wishlistProductIds.has(productId)) handleRemoveFromWishlist(e, productId);
      else handleAddToWishlist(e, productId);
    },
    [wishlistProductIds, handleRemoveFromWishlist, handleAddToWishlist]
  );

  const handleAddToCart = useCallback(
    (e: React.MouseEvent, productId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!shop?.orderAllowed) {
        toast("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
        return;
      }
      if (!tryMallPurchaseAction()) return;
      if (!clientId) return;
      setAddingCartId(productId);
      shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, productId, quantity: 1 }),
      })
        .then((res) => {
          if (res.ok) {
            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
            toast("장바구니에 추가되었습니다.", "success");
          } else {
            return res.json().then((err: { error?: string }) => {
              toast(err?.error || "장바구니 담기에 실패했습니다.", "error");
            });
          }
        })
        .catch(() => toast("네트워크 오류가 발생했습니다.", "error"))
        .finally(() => setAddingCartId(null));
    },
    [shop?.orderAllowed, tryMallPurchaseAction, clientId]
  );

  if (!shop) return null;

  const regClient = userClients[0]?.clients;

  const handleMoreView = (categorySlug: string) => {
    router.push(`${basePath}/products?category=${categorySlug}`);
  };

  return (
    <>
      <HeroCarousel />

      {/* 카테고리 탭: sticky는 바깥(overflow 없음), 가로 스크롤은 안쪽 — 스크롤 컨테이너가 main일 때도 top-0 기준으로 고정 */}
      {displayCategories.length > 0 && (
        <div className="sticky top-0 z-20 w-full min-w-0 border-b border-gray-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
          <div
            ref={categoryTabsRef}
            id="category-tabs"
            className="w-full min-w-0 select-none"
            style={{
              overflowX: "scroll",
              overflowY: "hidden",
              whiteSpace: "nowrap",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x",
              msOverflowStyle: "none",
              scrollbarWidth: "none",
              userSelect: "none",
            }}
            onMouseDown={handleCategoryTabsMouseDown}
            onMouseLeave={handleCategoryTabsMouseLeave}
            onMouseUp={handleCategoryTabsMouseUp}
            onMouseMove={handleCategoryTabsMouseMove}
          >
          <style
            dangerouslySetInnerHTML={{
              __html: "#category-tabs::-webkit-scrollbar { display: none; }",
            }}
          />
          <ul
            className="m-0 flex list-none p-0"
            style={{ width: "max-content" }}
            role="tablist"
            onDragStart={(e) => e.preventDefault()}
          >
            {displayCategories.map((cat) => {
              const isActive = activeCategorySlug === cat.slug;
              return (
                <li key={cat.id} className="flex-shrink-0 list-none">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={(e) => {
                      if (isDragMoved.current) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      setActiveCategorySlug(cat.slug);
                      router.replace(
                        `${basePath}?category=${encodeURIComponent(cat.slug)}`,
                        { scroll: false }
                      );
                      const el = document.getElementById(cat.id);
                      if (el) scrollShopMainToElement(el, 12);
                    }}
                    className={`block px-5 py-[9px] text-[15px] transition-colors ${
                      isActive
                        ? "text-white font-bold"
                        : "text-gray-600 font-medium hover:text-gray-900"
                    }`}
                    style={{
                      backgroundColor: isActive ? PRIMARY : "transparent",
                    }}
                  >
                    {cat.name}
                  </button>
                </li>
              );
            })}
          </ul>
          </div>
        </div>
      )}

      {/* 상품 섹션: 리프 노드만 */}
      {loading ? (
        <div className="px-4 pb-8">
          <div className="mb-4 h-6 w-24 animate-pulse rounded bg-[#E5E7EB]" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="text-left">
                <div className="aspect-[1/1] animate-pulse rounded-md bg-[#E5E7EB]" />
                <div className="mt-3 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-[#E5E7EB]" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-[#E5E7EB]" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-[#E5E7EB]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : displayCategories.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-[#9CA3AF]">
          등록된 상품이 없습니다.
        </div>
      ) : (
        <div className="px-4 pb-8">
          {displayCategories.map((category, catIndex) => {
            const products = productsByCategory[category.id] || [];
            if (products.length === 0) return null;

            return (
              <section
                key={category.id}
                id={category.id}
                className="mt-8 scroll-mt-[7rem]"
              >
                <h2 className="mb-4 px-0 text-xl font-medium tracking-tight text-[#333333]">
                  {category.name}
                </h2>

                <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                  {products.map((product, prodIndex) => {
                    const discountRate = getDiscountRate(
                      product.base_price,
                      product.sale_price
                    );
                    const isSoldOut = product.status === "sold_out";
                    const salePrice = product.sale_price ?? product.base_price;

                    return (
                      <div key={product.id} className="text-left">
                        <Link
                          href={`${basePath}/products/${product.slug}`}
                          className="block"
                        >
                          <div className="relative aspect-[1/1] overflow-hidden rounded-md bg-[#F3F4F6]">
                            {product.thumbnail_url ? (
                              <Image
                                src={product.thumbnail_url}
                                alt={product.name}
                                fill
                                sizes="(max-width: 768px) 50vw, 33vw"
                                className="object-cover"
                                priority={catIndex === 0 && prodIndex < 4}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[15px] text-[#9CA3AF]">
                                No Image
                              </div>
                            )}
                            {discountRate != null && discountRate > 0 && (
                              <span
                                className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-xs font-bold text-white"
                                style={{ backgroundColor: PRIMARY }}
                              >
                                {discountRate}%
                              </span>
                            )}
                            {!discountRate && (
                              <span className="absolute left-2 top-2 rounded bg-[#333333] px-1.5 py-0.5 text-xs font-medium text-white">
                                NEW
                              </span>
                            )}
                            {isSoldOut && (
                              <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                                품절
                              </span>
                            )}
                          </div>

                          <div className="mt-3">
                            <p className="line-clamp-2 text-[15px] font-normal leading-tight text-gray-800">
                              {product.name}
                            </p>
                            <div className="mt-1 flex items-baseline gap-1">
                              {discountRate != null && discountRate > 0 && (
                                <span
                                  className="font-bold"
                                  style={{ color: PRIMARY }}
                                >
                                  {discountRate}%
                                </span>
                              )}
                              <span className="font-bold text-[#111111]">
                                {formatPrice(salePrice)}원
                              </span>
                            </div>
                            {product.sale_price != null &&
                              product.sale_price < product.base_price && (
                                <p className="mt-1 text-xs text-[#9CA3AF] line-through">
                                  {formatPrice(product.base_price)}원
                                </p>
                              )}
                          </div>
                        </Link>
                        {/* 하트·장바구니: 동그라미 테두리 + 토글(담기/해제) */}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => toggleWishlist(e, product.id)}
                            disabled={!!addingWishlistId}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-800 disabled:opacity-50"
                            aria-label="관심상품 담기"
                          >
                            <Heart
                              strokeWidth={1.5}
                              className="h-4 w-4"
                              fill={wishlistProductIds.has(product.id) ? PRIMARY : "none"}
                              stroke={wishlistProductIds.has(product.id) ? PRIMARY : "currentColor"}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleAddToCart(e, product.id)}
                            disabled={isSoldOut || !!addingCartId}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="장바구니 담기"
                          >
                            <ShoppingBag
                              strokeWidth={1.5}
                              className="h-4 w-4"
                              style={{ color: "currentColor" }}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleMoreView(category.slug)}
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                  >
                    MORE VIEW →
                  </button>
                </div>
              </section>
            );
          })}

          {loadMore?.hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={loadMore.loading}
                onClick={loadMore.onLoadMore}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {"MORE VIEW →"}
              </button>
            </div>
          )}
        </div>
      )}

      <ShopBusinessInfoAccordion />

      <ShopPurchaseBlockModal
        isOpen={purchaseBlockOpen}
        onClose={() => setPurchaseBlockOpen(false)}
        reason={purchaseBlockReason}
        subdomain={subdomain}
        clientSlug={slugForPath}
        callbackUrl={
          typeof window !== "undefined"
            ? getShopRelativeReturnPath()
            : `/${subdomain}/${slugForPath}`
        }
        shopClientName={shop?.client?.name}
        registeredClientName={regClient?.name}
        registeredClientSlug={regClient?.slug}
        userEmail={session?.user?.email ?? null}
      />
    </>
  );
}

/** useSearchParams → Suspense 경계 필요 (Next App Router) */
export function ShopMainHome(props: ShopMainHomeProps) {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-[50vh] w-full bg-slate-50"
          style={{ paddingBottom: BOTTOM_NAV_HEIGHT }}
          aria-hidden
        />
      }
    >
      <ShopMainHomeWithCategoryUrl {...props} />
    </Suspense>
  );
}

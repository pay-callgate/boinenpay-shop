"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { useShopTemplate } from "./ShopTemplateContext";
import type { ShopPartner, ShopClient } from "./ShopLayout";
import { PREVIEW_SLUG } from "./ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "./ToastContext";

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

export function ShopMainHome({
  partner,
  client,
  subdomain,
  clientSlug,
  categories,
  productsByCategory,
  loadMore,
}: ShopMainHomeProps) {
  const router = useRouter();
  const shop = useShopTemplate();
  const clientId = shop?.client?.id ?? null;
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<string>>(new Set());
  const [wishlistItemIdsByProductId, setWishlistItemIdsByProductId] = useState<Record<string, string>>({});
  const [addingCartId, setAddingCartId] = useState<string | null>(null);
  const [addingWishlistId, setAddingWishlistId] = useState<string | null>(null);

  // 리프 노드만 노출: 부모 카테고리는 숨기고, 하위 카테고리 + 자식 없는 1차만 표시
  const parentIds = new Set(
    categories.map((c) => c.parent_id).filter(Boolean) as string[]
  );
  const displayCategories = categories.filter((cat) => !parentIds.has(cat.id));
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(
    displayCategories[0]?.slug ?? null
  );

  // 관심상품 목록 조회 (하트 채움 + 삭제 시 사용할 item id 저장)
  useEffect(() => {
    if (!clientId) return;
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
  }, [clientId]);

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
        toast("로그인 후 이용해 주세요.");
        return;
      }
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
    [clientId]
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
      const clientIdCookie = typeof document !== "undefined"
        ? document.cookie
            .split("; ")
            .find((row) => row.startsWith("client_source_id="))
            ?.split("=")[1]
        : null;
      if (!clientIdCookie) {
        toast("거래처 정보를 찾을 수 없습니다.");
        return;
      }
      setAddingCartId(productId);
      shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientIdCookie, productId, quantity: 1 }),
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
    [shop?.orderAllowed]
  );

  if (!shop) return null;

  const basePath = clientSlug ? `/${subdomain}/${clientSlug}` : `/${subdomain}/${PREVIEW_SLUG}`;

  const handleMoreView = (categorySlug: string) => {
    router.push(`${basePath}/products?category=${categorySlug}`);
  };

  return (
    <>
      <HeroCarousel />

      {/* 카테고리 탭: 리프 노드만 노출(부모 숨김, 하위·단일만), 가로 스크롤/슬라이딩 */}
      {displayCategories.length > 0 && (
        <div
          id="category-tabs"
          className="sticky top-14 z-[9] w-full min-w-0 border-b border-gray-200 bg-white"
          style={{
            overflowX: "scroll",
            overflowY: "hidden",
            whiteSpace: "nowrap",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          <style
            dangerouslySetInnerHTML={{
              __html: "#category-tabs::-webkit-scrollbar { display: none; }",
            }}
          />
          <ul
            className="flex p-0 m-0 list-none"
            style={{ width: "max-content" }}
            role="tablist"
          >
            {displayCategories.map((cat) => {
              const isActive = activeCategorySlug === cat.slug;
              return (
                <li key={cat.id} className="flex-shrink-0 list-none">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveCategorySlug(cat.slug);
                      const el = document.getElementById(cat.id);
                      if (el) {
                        const y =
                          el.getBoundingClientRect().top +
                          window.scrollY -
                          100;
                        window.scrollTo({ top: y, behavior: "smooth" });
                      }
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
      )}

      {/* 상품 섹션: 리프 노드만 */}
      {displayCategories.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-[#9CA3AF]">
          등록된 상품이 없습니다.
        </div>
      ) : (
        <div className="px-4 pb-8">
          {displayCategories.map((category) => {
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
                  {products.map((product) => {
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
                              <img
                                src={product.thumbnail_url}
                                alt={product.name}
                                className="h-full w-full object-cover"
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
                {loadMore.loading ? "로딩 중..." : "MORE VIEW →"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

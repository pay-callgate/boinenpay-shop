"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ShoppingBag } from "lucide-react";
import { useShopTemplate } from "./ShopTemplateContext";
import type { ShopPartner, ShopClient } from "./ShopLayout";
import { PREVIEW_SLUG } from "./ShopLayout";

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
  // 리프 노드만 노출: 부모 카테고리는 숨기고, 하위 카테고리 + 자식 없는 1차만 표시
  const parentIds = new Set(
    categories.map((c) => c.parent_id).filter(Boolean) as string[]
  );
  const displayCategories = categories.filter((cat) => !parentIds.has(cat.id));
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(
    displayCategories[0]?.slug ?? null
  );

  if (!shop) return null;

  const basePath = clientSlug ? `/${subdomain}/${clientSlug}` : `/${subdomain}/${PREVIEW_SLUG}`;

  const handleProductClick = (productSlug: string) => {
    router.push(`${basePath}/products/${productSlug}`);
  };

  const handleMoreView = (categorySlug: string) => {
    router.push(`${basePath}/products?category=${categorySlug}`);
  };

  return (
    <>
      <HeroCarousel />

      {/* 카테고리 탭: 리프 노드만 노출(부모 숨김, 하위·단일만), 가로 스크롤 */}
      {displayCategories.length > 0 && (
        <div
          id="category-tabs"
          className="sticky top-14 z-[9] w-full border-b border-gray-200 bg-white"
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            whiteSpace: "nowrap",
            WebkitOverflowScrolling: "touch",
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
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductClick(product.slug)}
                        className="text-left"
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
                          <div className="mt-2 flex items-center gap-2 text-[#9CA3AF]">
                            <Heart
                              strokeWidth={1.5}
                              className="h-4 w-4"
                              aria-hidden
                            />
                            <ShoppingBag
                              strokeWidth={1.5}
                              className="h-4 w-4"
                              aria-hidden
                            />
                          </div>
                        </div>
                      </button>
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

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";

/**
 * T4-2: 상품 목록 페이지 (PLP)
 * /{subdomain}/{clientSlug}/products
 * - 파트너(마스터 템플릿) 기준 카테고리/상품 조회
 * - 카테고리별 필터링, 정렬, 무한 스크롤
 */

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  base_price: number;
  sale_price: number | null;
  status: string;
  categories: Category[];
}

export default function ProductListPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const template = useShopTemplate();
  const partnerId = template?.partner?.id ?? null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const categorySlug = searchParams?.get("category");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "price_asc" | "price_desc">("recent");
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // 카테고리 목록 조회
  useEffect(() => {
    async function fetchCategories() {
      if (!partnerId) return;
      const res = await fetch(`/api/shop/categories?partnerId=${partnerId}&onlyWithProducts=true`);
      if (res.ok) {
        const data = await res.json();
        const list = data?.categories ?? [];
        setCategories(list);

        if (categorySlug && list.length > 0) {
          const found = list.find((c: Category) => c.slug === categorySlug);
          setSelectedCategory(found ?? null);
        }
      }
    }
    fetchCategories();
  }, [partnerId, categorySlug]);

  // 상품 목록 조회
  useEffect(() => {
    async function fetchProducts() {
      if (!partnerId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      let url = `/api/shop/products?partnerId=${partnerId}&limit=${limit}&offset=${offset}`;
      if (selectedCategory?.id) {
        url += `&categoryId=${selectedCategory.id}`;
      }

      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const list = data?.products ?? [];
          const totalCount = data?.total ?? 0;
          if (offset === 0) {
            setProducts(list);
          } else {
            setProducts((prev) => [...prev, ...list]);
          }
          setTotal(totalCount);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [partnerId, selectedCategory, offset]);

  // 정렬 처리 (클라이언트 사이드)
  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === "price_asc") {
      const priceA = a.sale_price || a.base_price;
      const priceB = b.sale_price || b.base_price;
      return priceA - priceB;
    } else if (sortBy === "price_desc") {
      const priceA = a.sale_price || a.base_price;
      const priceB = b.sale_price || b.base_price;
      return priceB - priceA;
    }
    // recent, popular은 API 기본 정렬(created_at desc) 사용
    return 0;
  });

  // 가격 포맷팅
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ko-KR").format(price);
  };

  // 할인율 계산
  const getDiscountRate = (basePrice: number, salePrice: number | null) => {
    if (!salePrice || salePrice >= basePrice) return null;
    return Math.round(((basePrice - salePrice) / basePrice) * 100);
  };

  // 더보기
  const loadMore = () => {
    if (products.length < total) {
      setOffset((prev) => prev + limit);
    }
  };

  if (template == null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-slate-100">
        <p className="text-slate-600">로딩 중...</p>
      </div>
    );
  }

  if (!partnerId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-slate-100 px-4">
        <p className="text-center text-slate-700">파트너 정보를 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/${clientSlug}`)}
          className="mt-4 rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600"
        >
          홈으로
        </button>
      </div>
    );
  }

  return (
    <OrderGuard partnerId={partnerId ?? undefined}>
      <div
        style={{
          maxWidth: "430px",
          margin: "0 auto",
          minHeight: "100vh",
          backgroundColor: "#fff",
          paddingBottom: "80px",
        }}
      >
        {/* 카테고리 필터 (헤더는 글로벌 SmartHeader에서 제공) */}
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={() => {
              setSelectedCategory(null);
              setOffset(0);
              router.push(`/${subdomain}/${clientSlug}/products`);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: !selectedCategory ? "2px solid #D6A8E0" : "1px solid #E5E7EB",
              backgroundColor: !selectedCategory ? "#F8F5FF" : "#fff",
              color: !selectedCategory ? "#D6A8E0" : "#666",
              fontSize: "0.875rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat);
                setOffset(0);
                router.push(`/${subdomain}/${clientSlug}/products?category=${cat.slug}`);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: selectedCategory?.id === cat.id ? "2px solid #D6A8E0" : "1px solid #E5E7EB",
                backgroundColor: selectedCategory?.id === cat.id ? "#F8F5FF" : "#fff",
                color: selectedCategory?.id === cat.id ? "#D6A8E0" : "#666",
                fontSize: "0.875rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* 정렬 및 결과 수 */}
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <p style={{ fontSize: "0.875rem", color: "#666" }}>
            총 {total}개
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: "6px 12px",
              border: "1px solid #E5E7EB",
              borderRadius: "6px",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            <option value="recent">최신순</option>
            <option value="popular">인기순</option>
            <option value="price_asc">낮은 가격순</option>
            <option value="price_desc">높은 가격순</option>
          </select>
        </div>

        {/* 상품 그리드 */}
        {loading && offset === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#999" }}>로딩 중...</p>
          </div>
        ) : sortedProducts.length === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#999", fontSize: "0.9375rem" }}>
              상품이 없습니다.
            </p>
          </div>
        ) : (
          <div style={{ padding: "16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              {sortedProducts.map((product) => {
                const discountRate = getDiscountRate(product.base_price, product.sale_price);
                const isSoldOut = product.status === "sold_out";

                return (
                  <div
                    key={product.id}
                    onClick={() =>
                      router.push(`/${subdomain}/${clientSlug}/products/${product.slug}`)
                    }
                    style={{
                      cursor: "pointer",
                    }}
                  >
                    {/* 썸네일 */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        paddingTop: "100%",
                        backgroundColor: "#F3F4F6",
                        borderRadius: "8px",
                        overflow: "hidden",
                        marginBottom: "8px",
                      }}
                    >
                      {product.thumbnail_url && (
                        <img
                          src={product.thumbnail_url}
                          alt={product.name}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      )}
                      {/* 품절 배지 */}
                      {isSoldOut && (
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            padding: "4px 8px",
                            backgroundColor: "#6B7280",
                            color: "#fff",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            borderRadius: "4px",
                          }}
                        >
                          SOLD OUT
                        </div>
                      )}
                    </div>

                    {/* 상품 정보 */}
                    <div>
                      <p
                        style={{
                          fontSize: "0.875rem",
                          marginBottom: "4px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {product.name}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {discountRate && (
                          <span
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: 700,
                              color: "#DC2626",
                            }}
                          >
                            {discountRate}%
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "1rem",
                            fontWeight: 700,
                          }}
                        >
                          {formatPrice(product.sale_price || product.base_price)}원
                        </span>
                      </div>
                      {product.sale_price && (
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "#9CA3AF",
                            textDecoration: "line-through",
                          }}
                        >
                          {formatPrice(product.base_price)}원
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 더보기 버튼 (아웃라인 스타일, 중앙 정렬) */}
            {products.length < total && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "로딩 중..." : "더보기"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </OrderGuard>
  );
}

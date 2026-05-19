"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Heart, ShoppingBag } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import {
  ShopPurchaseBlockModal,
  type ShopPurchaseBlockReason,
} from "@/components/shop/ShopPurchaseBlockModal";
import { useUserClient } from "@/hooks/useUserClient";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";
import { getShopRelativeReturnPath } from "@/lib/shop-callback-url";

const PRIMARY = "#D6A8E0";

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
  const { data: session, status: sessionStatus } = useSession();
  const { userClients, loading: userClientLoading } = useUserClient(partnerId ?? undefined);

  const [purchaseBlockOpen, setPurchaseBlockOpen] = useState(false);
  const [purchaseBlockReason, setPurchaseBlockReason] =
    useState<ShopPurchaseBlockReason>("login");

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const categorySlug = searchParams?.get("category");
  const categorySlugTrimmed = (categorySlug ?? "").trim();
  const isAllCategoryTab = !categorySlugTrimmed;
  const searchQuery = searchParams?.get("search") || searchParams?.get("q") || "";

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesReady, setCategoriesReady] = useState(false);
  /** fetch 완료 후에도 URL이 바뀌었는지 판별 (늦게 도착한 이전 카테고리 응답 폐기) */
  const categorySlugLatestRef = useRef(categorySlugTrimmed);
  categorySlugLatestRef.current = categorySlugTrimmed;
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "price_asc" | "price_desc">("price_asc");
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<string>>(new Set());
  const [addingCartId, setAddingCartId] = useState<string | null>(null);
  const [addingWishlistId, setAddingWishlistId] = useState<string | null>(null);

  const clientId = template?.client?.id ?? null;

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

  // 관심상품 목록 조회 (아이콘 채움 표시용) — 비로그인 401 시 shopFetch 전역 세션 만료 처리 방지
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !clientId) return;
    shopFetch(`/api/mypage/wishlist?clientId=${clientId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const items = data?.items ?? [];
        setWishlistProductIds(new Set(items.map((i: { product: { id: string } }) => i.product?.id).filter(Boolean)));
      })
      .catch(() => {});
  }, [clientId, sessionStatus]);

  const handleAddToWishlist = useCallback(
    async (e: React.MouseEvent, productId: string) => {
      e.stopPropagation();
      if (!clientId) {
        toast("거래처 정보를 불러올 수 없습니다.");
        return;
      }
      if (!tryMallPurchaseAction()) return;
      setAddingWishlistId(productId);
      try {
        const res = await shopFetch("/api/mypage/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, clientId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok || data.message?.includes("이미")) {
          setWishlistProductIds((prev) => new Set(prev).add(productId));
          if (res.ok) toast("관심상품에 담았습니다.", "success");
        } else {
          toast(data.error || "관심상품 담기에 실패했습니다.", "error");
        }
      } catch {
        toast("네트워크 오류가 발생했습니다.", "error");
      } finally {
        setAddingWishlistId(null);
      }
    },
    [clientId, tryMallPurchaseAction]
  );

  const handleAddToCart = useCallback(
    async (e: React.MouseEvent, productId: string) => {
      e.stopPropagation();
      if (!template?.orderAllowed) {
        toast("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
        return;
      }
      if (!tryMallPurchaseAction()) return;
      if (!clientId) return;
      setAddingCartId(productId);
      try {
        const res = await shopFetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, productId, quantity: 1 }),
        });
        if (res.ok) {
          if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
          toast("장바구니에 추가되었습니다.", "success");
        } else {
          const err = await res.json();
          toast(err?.error || "장바구니 담기에 실패했습니다.", "error");
        }
      } catch {
        toast("네트워크 오류가 발생했습니다.", "error");
      } finally {
        setAddingCartId(null);
      }
    },
    [template?.orderAllowed, tryMallPurchaseAction, clientId]
  );

  // 카테고리 목록만 조회 — PLP 필터는 URL(`?category=`)을 단일 소스로 사용
  useEffect(() => {
    setCategoriesReady(false);
    async function fetchCategories() {
      if (!partnerId) {
        setCategoriesReady(true);
        return;
      }
      try {
        const res = await shopFetch(`/api/shop/categories?partnerId=${partnerId}&onlyWithProducts=false`);
        if (res.ok) {
          const data = await res.json();
          setCategories(data?.categories ?? []);
        } else {
          setCategories([]);
        }
      } catch {
        setCategories([]);
      } finally {
        setCategoriesReady(true);
      }
    }
    void fetchCategories();
  }, [partnerId]);

  /** 카테고리(쿼리) 바뀔 때 더보기 오프셋 초기화 */
  useEffect(() => {
    setOffset(0);
  }, [categorySlug]);

  // 상품 목록 조회 — categoryId는 URL 슬러그에서만 계산(로컬 state와 한 박자 어긋난 요청 방지)
  useEffect(() => {
    async function fetchProducts() {
      if (!partnerId) {
        setLoading(false);
        return;
      }

      const slug = categorySlugTrimmed;
      if (slug && !categoriesReady) {
        return;
      }

      const categoryIdForRequest = slug
        ? categories.find((c) => c.slug === slug)?.id
        : undefined;

      setLoading(true);
      const slugWhenStarted = slug;

      let url = `/api/shop/products?partnerId=${partnerId}&limit=${limit}&offset=${offset}`;
      if (categoryIdForRequest) {
        url += `&categoryId=${categoryIdForRequest}`;
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      try {
        const res = await shopFetch(url);
        if (slugWhenStarted !== categorySlugLatestRef.current) {
          return;
        }
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
        if (slugWhenStarted === categorySlugLatestRef.current) {
          setLoading(false);
        }
      }
    }

    void fetchProducts();
  }, [partnerId, categorySlugTrimmed, categories, categoriesReady, searchQuery, offset]);

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
    return <div className="min-h-[50vh] bg-slate-100" />;
  }

  if (!partnerId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center bg-slate-100 px-4">
        <p className="text-center text-slate-700">파트너 정보를 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/${clientSlug}`)}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: PRIMARY }}
        >
          홈으로
        </button>
      </div>
    );
  }

  // PLP 필터·탭 하이라이트는 `?category=`(없으면 전체) 단일 소스. SideMenu 등도 동일하게 맞출 것.
  const regClient = userClients[0]?.clients;

  return (
    <OrderGuard
      partnerId={partnerId ?? undefined}
      shopClientId={clientId ?? undefined}
      shopClientName={template?.client?.name ?? undefined}
      requireAuth={false}
      blockAffiliationMismatch={false}
    >
      <div
        style={{
          maxWidth: "430px",
          margin: "0 auto",
          minHeight: "100vh",
          backgroundColor: "#fff",
          paddingBottom: "80px",
        }}
      >
        {/* 카테고리 필터: 가로 슬라이딩(터치 스크롤) */}
        <div
          className="products-category-tabs w-full min-w-0"
          style={{
            padding: "12px 16px",
            display: "flex",
            gap: "8px",
            overflowX: "scroll",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
            borderBottom: "1px solid #E5E7EB",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <style
            dangerouslySetInnerHTML={{
              __html: ".products-category-tabs::-webkit-scrollbar { display: none; }",
            }}
          />
          <button
            onClick={() => {
              setOffset(0);
              router.push(`/${subdomain}/${clientSlug}/products`);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: isAllCategoryTab ? "2px solid #D6A8E0" : "1px solid #E5E7EB",
              backgroundColor: isAllCategoryTab ? "#F8F5FF" : "#fff",
              color: isAllCategoryTab ? "#D6A8E0" : "#666",
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
                setOffset(0);
                router.push(`/${subdomain}/${clientSlug}/products?category=${cat.slug}`);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border:
                  categorySlugTrimmed === cat.slug ? "2px solid #D6A8E0" : "1px solid #E5E7EB",
                backgroundColor: categorySlugTrimmed === cat.slug ? "#F8F5FF" : "#fff",
                color: categorySlugTrimmed === cat.slug ? "#D6A8E0" : "#666",
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

        {/* 검색 중일 때 검색어 표시 */}
        {searchQuery.trim() && (
          <div
            style={{
              padding: "8px 16px",
              backgroundColor: "#F8F5FF",
              borderBottom: "1px solid #E5E7EB",
              fontSize: "0.875rem",
              color: "#D6A8E0",
              fontWeight: 500,
            }}
          >
            검색: &quot;{searchQuery.trim()}&quot;
          </div>
        )}

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
            <option value="price_asc">낮은 가격순</option>
            <option value="price_desc">높은 가격순</option>
            <option value="recent">최신순</option>
            <option value="popular">인기순</option>
          </select>
        </div>

        {/* 상품 그리드 */}
        {loading && offset === 0 ? (
          <div style={{ padding: "40px 16px" }} />
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
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "16px",
                width: "100%",
                minWidth: 0,
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
                      minWidth: 0,
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
                      {/* 관심상품 / 장바구니 아이콘 (클릭 시 상세 이동 방지) */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          right: "8px",
                          display: "flex",
                          gap: "6px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleAddToWishlist(e, product.id)}
                          disabled={!!addingWishlistId}
                          aria-label="관심상품 담기"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "rgba(255,255,255,0.95)",
                            border: "none",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                            cursor: addingWishlistId ? "wait" : "pointer",
                          }}
                        >
                          <Heart
                            strokeWidth={1.5}
                            className="h-4 w-4"
                            fill={wishlistProductIds.has(product.id) ? PRIMARY : "none"}
                            stroke={wishlistProductIds.has(product.id) ? PRIMARY : "#374151"}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleAddToCart(e, product.id)}
                          disabled={isSoldOut || !!addingCartId}
                          aria-label="장바구니 담기"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "rgba(255,255,255,0.95)",
                            border: "none",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                            cursor: isSoldOut || addingCartId ? "not-allowed" : "pointer",
                          }}
                        >
                          <ShoppingBag
                            strokeWidth={1.5}
                            className="h-4 w-4"
                            style={{ color: "#374151" }}
                          />
                        </button>
                      </div>
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
                  {"더보기"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ShopPurchaseBlockModal
        isOpen={purchaseBlockOpen}
        onClose={() => setPurchaseBlockOpen(false)}
        reason={purchaseBlockReason}
        subdomain={subdomain}
        clientSlug={clientSlug}
        callbackUrl={
          typeof window !== "undefined"
            ? getShopRelativeReturnPath()
            : `/${subdomain}/${clientSlug}/products`
        }
        shopClientName={template?.client?.name}
        registeredClientName={regClient?.name}
        registeredClientSlug={regClient?.slug}
        userEmail={session?.user?.email ?? null}
      />
    </OrderGuard>
  );
}

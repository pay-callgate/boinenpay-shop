"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";

/**
 * T6-5: 관심상품(Wishlist)
 * /{subdomain}/{clientSlug}/mypage/wishlist
 * partner/client는 ShopTemplateContext에서 사용.
 */

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  discount_rate: number;
  thumbnail_url: string | null;
  status: string;
}

interface WishlistItem {
  id: string;
  created_at: string;
  product: Product;
}

export default function WishlistPage() {
  const params = useParams();
  const router = useRouter();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 관심상품 목록 조회 (Context 준비 후 실행)
  useEffect(() => {
    if (!partner?.id || !client?.id) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/mypage/wishlist?clientId=${client.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setItems(data?.items ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partner?.id, client?.id]);

  // 관심상품 목록 다시 불러오기
  const refetchWishlist = () => {
    if (!client?.id) return;
    setLoading(true);
    fetch(`/api/mypage/wishlist?clientId=${client.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setItems(data?.items ?? []))
      .finally(() => setLoading(false));
  };

  // 관심상품 삭제
  const handleDelete = async (id: string) => {
    if (!confirm("관심상품에서 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/mypage/wishlist/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("관심상품에서 삭제되었습니다.");
        refetchWishlist();
      } else {
        const error = await res.json();
        alert(error.error || "삭제에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  // 가격 포맷팅
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ko-KR").format(price);
  };

  // 할인율 계산
  const getDiscountRate = (price: number, discountRate: number) => {
    if (!discountRate || discountRate <= 0) return null;
    return discountRate;
  };

  // 할인가 계산
  const getDiscountedPrice = (price: number, discountRate: number) => {
    if (!discountRate || discountRate <= 0) return price;
    return price * (1 - discountRate / 100);
  };

  if (template == null || !partner || !client) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F5F5",
        }}
      >
        <p style={{ color: "#666" }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <OrderGuard partnerId={partner.id}>
      <div
        style={{
          maxWidth: "430px",
          margin: "0 auto",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F5F5F5",
          paddingBottom: "80px",
        }}
      >
        {/* 헤더 */}
        <header
          style={{
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "#fff",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={() => router.push(`/${subdomain}/${clientSlug}/mypage`)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="#333"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, flex: 1 }}>
            관심상품
          </h1>
          <span style={{ fontSize: "0.875rem", color: "#666" }}>
            {items.length}개
          </span>
        </header>

        {/* 관심상품 목록 */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#fff",
          }}
        >
        {loading ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#999" }}>로딩 중...</p>
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: "60px 16px",
              textAlign: "center",
            }}
          >
            <svg
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              style={{ margin: "0 auto 16px" }}
            >
              <path
                d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                stroke="#D1D5DB"
                strokeWidth="2"
                fill="none"
              />
            </svg>
            <p style={{ fontSize: "1rem", color: "#666", marginBottom: "24px" }}>
              관심상품이 없습니다
            </p>
            <button
              onClick={() => router.push(`/${subdomain}/${clientSlug}/products`)}
              style={{
                padding: "12px 24px",
                backgroundColor: "#D6A8E0",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              쇼핑하러 가기
            </button>
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
              {items.map((item) => {
                const product = item.product;
                const isSoldOut = product.status === "sold_out";
                const discountRate = getDiscountRate(product.price, product.discount_rate);
                const finalPrice = getDiscountedPrice(product.price, product.discount_rate);

                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: "1px solid #E5E7EB",
                      position: "relative",
                    }}
                  >
                    {/* 상품 이미지 */}
                    <div
                      onClick={() =>
                        router.push(`/${subdomain}/${clientSlug}/products/${product.slug}`)
                      }
                      style={{
                        position: "relative",
                        paddingBottom: "100%",
                        backgroundColor: "#F3F4F6",
                        cursor: "pointer",
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
                            opacity: isSoldOut ? 0.5 : 1,
                          }}
                        />
                      )}
                      {isSoldOut && (
                        <div
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            backgroundColor: "rgba(0,0,0,0.7)",
                            color: "#fff",
                            padding: "8px 16px",
                            borderRadius: "4px",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          품절
                        </div>
                      )}
                      {/* 삭제 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(0,0,0,0.5)",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1rem",
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {/* 상품 정보 */}
                    <div
                      onClick={() =>
                        router.push(`/${subdomain}/${clientSlug}/products/${product.slug}`)
                      }
                      style={{
                        padding: "12px",
                        cursor: "pointer",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.875rem",
                          marginBottom: "8px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {product.name}
                      </p>
                      <div>
                        {discountRate && (
                          <div style={{ marginBottom: "4px" }}>
                            <span
                              style={{
                                fontSize: "0.875rem",
                                fontWeight: 700,
                                color: "#EF4444",
                                marginRight: "4px",
                              }}
                            >
                              {discountRate}%
                            </span>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "#999",
                                textDecoration: "line-through",
                              }}
                            >
                              {formatPrice(product.price)}원
                            </span>
                          </div>
                        )}
                        <p
                          style={{
                            fontSize: "1rem",
                            fontWeight: 700,
                            color: isSoldOut ? "#999" : "#333",
                          }}
                        >
                          {formatPrice(finalPrice)}원
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>

        {/* Bottom Nav */}
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            maxWidth: "430px",
            margin: "0 auto",
            backgroundColor: "#fff",
            display: "flex",
            justifyContent: "space-around",
            padding: "12px 0",
            borderTop: "1px solid #E5E7EB",
          }}
        >
          {[
            { icon: "🏠", label: "홈", path: "" },
            { icon: "📂", label: "카테고리", path: "/products" },
            { icon: "🛒", label: "장바구니", path: "/cart" },
            { icon: "👤", label: "마이페이지", path: "/mypage", active: true },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() =>
                router.push(`/${subdomain}/${clientSlug}${item.path}`)
              }
              style={{
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                fontSize: "0.75rem",
                color: item.active ? "#D6A8E0" : "#666",
                fontWeight: item.active ? 600 : 400,
              }}
            >
              <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </OrderGuard>
  );
}

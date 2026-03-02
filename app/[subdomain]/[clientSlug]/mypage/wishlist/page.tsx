"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import type { ShopPartner, ShopClient } from "@/components/shop/ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";

/**
 * T6-5: 관심상품(Wishlist)
 * /{subdomain}/{clientSlug}/mypage/wishlist
 * UI: 최근 본 상품 페이지와 동일 레이아웃·Tailwind 재활용 + 체크박스, 전체선택, 선택삭제, 전체상품주문
 */

interface Product {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  sale_price: number | null;
  thumbnail_url: string | null;
  status: string;
}

interface WishlistItem {
  id: string;
  created_at: string;
  product: Product;
}

const PRIMARY = "#D6A8E0";

function formatPrice(price: number): string {
  const n = Number(price);
  if (Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("ko-KR").format(n);
}

function getDiscountRate(basePrice: number, salePrice: number | null): number | null {
  const base = Number(basePrice);
  const sale = salePrice != null ? Number(salePrice) : null;
  if (Number.isNaN(base) || sale == null || sale >= base) return null;
  return Math.round(((base - sale) / base) * 100);
}

export default function WishlistPage() {
  const params = useParams();
  const router = useRouter();
  const template = useShopTemplate();
  const partner = (template?.partner ?? null) as ShopPartner | null;
  const client = (template?.client ?? null) as ShopClient | null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const base = `/${subdomain}/${clientSlug}`;

  const refetchWishlist = useCallback(() => {
    if (!client?.id) return;
    setLoading(true);
    shopFetch(`/api/mypage/wishlist?clientId=${client.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setItems(data?.items ?? []))
      .finally(() => setLoading(false));
  }, [client?.id]);

  useEffect(() => {
    if (!client?.id) return;
    refetchWishlist();
  }, [client?.id, refetchWishlist]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("관심상품에서 삭제하시겠습니까?")) return;
    try {
      const res = await shopFetch(`/api/mypage/wishlist/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        refetchWishlist();
      } else {
        const err = await res.json();
        alert(err.error || "삭제에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert("삭제할 항목을 선택해 주세요.");
      return;
    }
    if (!confirm(`선택한 ${selectedIds.size}개 항목을 관심상품에서 삭제하시겠습니까?`)) return;
    const idsToDelete = new Set(selectedIds);
    try {
      const results = await Promise.all(
        Array.from(idsToDelete).map((id) =>
          shopFetch(`/api/mypage/wishlist/${id}`, { method: "DELETE" }).then((r) => ({ id, ok: r.ok }))
        )
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        alert("일부 삭제에 실패했습니다.");
      }
      setSelectedIds(new Set());
      setItems((prev) => prev.filter((item) => !idsToDelete.has(item.id)));
    } catch {
      alert("일부 삭제에 실패했습니다.");
    }
  };

  const handleAddToCart = async (productId: string) => {
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
    try {
      const res = await shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientIdCookie, productId, quantity: 1 }),
      });
      if (res.ok) {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
        alert("장바구니에 추가되었습니다.");
      } else {
        const err = await res.json();
        alert(err.error || "장바구니 추가에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const handleOrderNow = async (productId: string) => {
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
    try {
      const res = await shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientIdCookie, productId, quantity: 1 }),
      });
      if (res.ok) {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
        router.push(`${base}/checkout`);
      } else {
        const err = await res.json();
        alert(err.error ?? "장바구니 추가에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const handleOrderAll = async () => {
    if (items.length === 0) return;
    if (!template?.orderAllowed) {
      alert("마스터 템플릿 미리보기 상태에서는 주문이 불가능합니다.");
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
    try {
      for (const item of items) {
        await shopFetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: clientIdCookie,
            productId: item.product.id,
            quantity: 1,
          }),
        });
      }
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
      router.push(`${base}/checkout`);
    } catch {
      alert("장바구니 담기 중 오류가 발생했습니다.");
    }
  };

  if (template == null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!partner || !client) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
        <p className="mb-4 text-gray-500">정보를 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push(`${base}`)}
          className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          홈으로
        </button>
      </div>
    );
  }

  const content = (
    <div className="min-h-full bg-white">
      <div className="border-b border-gray-100 px-4 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`${base}/mypage`)}
            className="p-1 -ml-1 rounded hover:bg-gray-100"
            aria-label="뒤로"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-800">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 flex-1">관심상품</h1>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-16 text-center">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16">
          <Heart
            className="mb-4 h-14 w-14 text-gray-300"
            strokeWidth={1.25}
            fill="none"
            aria-hidden
          />
          <p className="mb-6 text-[15px] text-gray-600">관심상품이 없습니다</p>
          <button
            type="button"
            onClick={() => router.push(`${base}/products`)}
            className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            쇼핑하러 가기
          </button>
        </div>
      ) : (
        <>
          {/* 전체선택 / 선택삭제 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={items.length > 0 && selectedIds.size === items.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">전체선택</span>
            </label>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0}
              className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              선택삭제
            </button>
          </div>

          <ul className="flex flex-col gap-4 px-4 pb-8 pt-4">
            {items.map((item) => {
              const p = item.product;
              const basePrice = Number(p.base_price) || 0;
              const salePrice = p.sale_price != null ? Number(p.sale_price) : null;
              const discountRate = getDiscountRate(basePrice, salePrice);
              const finalPrice = salePrice != null && salePrice < basePrice ? salePrice : basePrice;
              const isSoldOut = p.status === "sold_out";
              const savedAmount =
                discountRate != null && discountRate > 0
                  ? Math.round((basePrice * discountRate) / 100)
                  : null;

              return (
                <li
                  key={item.id}
                  className="flex flex-row gap-3 rounded-lg border border-gray-100 bg-white p-3"
                >
                  <div className="flex shrink-0 items-start pt-0.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </div>
                  <Link
                    href={`${base}/products/${p.slug}`}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-gray-100"
                  >
                    {p.thumbnail_url ? (
                      <img
                        src={p.thumbnail_url}
                        alt={p.name}
                        className={`h-full w-full object-cover ${isSoldOut ? "opacity-50" : ""}`}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                        No Image
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`${base}/products/${p.slug}`} className="block">
                      <p className="line-clamp-2 text-[15px] font-normal leading-tight text-gray-800">
                        {p.name}
                      </p>
                    </Link>
                    <div className="mt-1 flex flex-wrap items-baseline gap-1">
                      {discountRate != null && discountRate > 0 && (
                        <span className="text-sm font-bold text-red-500">{discountRate}%</span>
                      )}
                      <span className="text-xs text-gray-400 line-through">
                        {formatPrice(basePrice)}원
                      </span>
                      <span
                        className={`text-[15px] font-bold ${
                          isSoldOut ? "text-gray-400" : "text-gray-900"
                        }`}
                      >
                        {formatPrice(finalPrice)}원
                      </span>
                    </div>
                    {savedAmount != null && savedAmount > 0 && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {formatPrice(savedAmount)}원 ({discountRate}%)
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600"
                      >
                        삭제
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddToCart(p.id)}
                        disabled={isSoldOut}
                        className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50"
                      >
                        장바구니 담기
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOrderNow(p.id)}
                        disabled={isSoldOut}
                        className="ml-auto rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        주문하기
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* 전체상품주문 — 브랜드 메인 테마(보라색 계열) */}
          <div className="border-t border-gray-100 px-4 py-4">
            <button
              type="button"
              onClick={handleOrderAll}
              className="w-full rounded-xl py-4 text-base font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: PRIMARY }}
            >
              전체상품주문
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <OrderGuard partnerId={partner.id}>
      {content}
    </OrderGuard>
  );
}

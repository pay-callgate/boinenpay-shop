"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Clock } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import type { ShopPartner, ShopClient } from "@/components/shop/ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";
import {
  getRecentProducts,
  removeRecentProduct,
  type RecentProductItem,
} from "@/lib/recent-products";
import { getShopRelativeReturnPath } from "@/lib/shop-callback-url";

/**
 * T8-2: 최근 본 상품 (localStorage 기반, 비로그인·타 소속도 목록 열람 가능)
 * /{subdomain}/{clientSlug}/recent
 */

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

export default function RecentProductsPage() {
  const params = useParams();
  const router = useRouter();
  const template = useShopTemplate();
  const partner = (template?.partner ?? null) as ShopPartner | null;
  const client = (template?.client ?? null) as ShopClient | null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const { status: sessionStatus } = useSession();

  const [items, setItems] = useState<RecentProductItem[]>([]);

  useEffect(() => {
    setItems(getRecentProducts(subdomain, clientSlug));
  }, [subdomain, clientSlug]);

  useEffect(() => {
    const onFocus = () =>
      setItems(getRecentProducts(subdomain, clientSlug));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [subdomain, clientSlug]);

  const base = `/${subdomain}/${clientSlug}`;

  /** 임시저장 등은 목록에서 제외(판매중·품절만 표시, localStorage 과거 데이터 대비) */
  const visibleItems = items.filter(
    (item) => item.status === "active" || item.status === "sold_out"
  );

  const handleRemove = (productId: string) => {
    removeRecentProduct(subdomain, clientSlug, productId);
    setItems((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleAddToCart = async (productId: string) => {
    if (!template?.orderAllowed) {
      toast("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
      return;
    }
    const clientIdCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("client_source_id="))
      ?.split("=")[1];
    const cartClientId = client?.id ?? clientIdCookie;
    if (!cartClientId) {
      toast("거래처 정보를 찾을 수 없습니다.");
      return;
    }
    try {
      const res = await shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: cartClientId, productId, quantity: 1 }),
        handleSessionExpiry: false,
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
    }
  };

  const handleOrderNow = async (productId: string) => {
    if (!template?.orderAllowed) {
      toast("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
      return;
    }
    const clientIdCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("client_source_id="))
      ?.split("=")[1];
    const cartClientId = client?.id ?? clientIdCookie;
    if (!cartClientId) {
      toast("거래처 정보를 찾을 수 없습니다.");
      return;
    }
    try {
      const res = await shopFetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: cartClientId, productId, quantity: 1 }),
        handleSessionExpiry: false,
      });
      if (res.ok) {
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
        router.push(`${base}/checkout`);
        return;
      }
      const err = await res.json();
      toast(err.error ?? "장바구니 추가에 실패했습니다.", "error");
    } catch {
      toast("네트워크 오류가 발생했습니다.", "error");
    }
  };

  if (template == null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500"></p>
      </div>
    );
  }

  if (!partner || !client) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
        <p className="mb-4 text-gray-500">정보를 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/${clientSlug}`)}
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
        <h1 className="text-xl font-bold tracking-tight text-gray-900">최근 본 상품</h1>
      </div>

      {visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16">
          <Clock
            className="mb-4 h-14 w-14 text-gray-300"
            strokeWidth={1.25}
            aria-hidden
          />
          {sessionStatus === "unauthenticated" ? (
            <>
              <p className="mb-6 max-w-[300px] text-center text-[15px] leading-relaxed text-gray-700">
                최근 본 상품이 없습니다. 로그인하시면 상품을 기록해 드릴게요!
              </p>
              <div className="flex w-full max-w-[280px] flex-col gap-2">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/${subdomain}/login?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? getShopRelativeReturnPath() : `${base}/recent`)}`
                    )
                  }
                  className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: PRIMARY }}
                >
                  로그인하기
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`${base}/products`)}
                  className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-800"
                >
                  쇼핑하러 가기
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-6 text-[15px] text-gray-600">최근 본 상품이 없습니다</p>
              <button
                type="button"
                onClick={() => router.push(`${base}/products`)}
                className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: PRIMARY }}
              >
                쇼핑하러 가기
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-4 px-4 pb-8 pt-4">
          {visibleItems.map((item) => {
            const basePrice = Number(item.base_price) || 0;
            const salePrice =
              item.sale_price != null ? Number(item.sale_price) : null;
            const discountRate = getDiscountRate(basePrice, salePrice);
            const finalPrice = salePrice != null && salePrice < basePrice ? salePrice : basePrice;
            const isSoldOut = item.status === "sold_out";
            const savedAmount =
              discountRate != null && discountRate > 0
                ? Math.round((basePrice * discountRate) / 100)
                : null;

            return (
              <li
                key={item.id}
                className="flex flex-row gap-4 rounded-lg border border-gray-100 bg-white p-3"
              >
                <Link
                  href={`${base}/products/${item.slug}`}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-gray-100"
                >
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.name}
                      className={`h-full w-full object-cover ${isSoldOut ? "opacity-50" : ""}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      No Image
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`${base}/products/${item.slug}`} className="block">
                    <p className="line-clamp-2 text-[15px] font-normal leading-tight text-gray-800">
                      {item.name}
                    </p>
                  </Link>
                  <div className="mt-1 flex flex-wrap items-baseline gap-1">
                    {discountRate != null && discountRate > 0 && (
                      <span className="text-sm font-bold text-red-500">
                        {discountRate}%
                      </span>
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
                  {/* 모바일 전용: 3버튼 1열 동등 폭, 초소형 기기는 text-[10px]·min-h-9 */}
                  <div className="mt-3 grid w-full min-w-0 grid-cols-3 gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded border border-gray-200 bg-white px-1 py-1 text-center text-[10px] font-medium leading-[1.2] text-gray-600 active:bg-gray-50 sm:min-h-10 sm:px-2 sm:text-xs sm:leading-snug"
                    >
                      삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(item.id)}
                      disabled={isSoldOut}
                      className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded border border-gray-200 bg-white px-0.5 py-1 text-center text-[10px] font-medium leading-[1.2] text-gray-700 [word-break:keep-all] active:bg-gray-50 disabled:opacity-50 sm:min-h-10 sm:px-2 sm:text-xs sm:leading-snug"
                    >
                      장바구니 담기
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOrderNow(item.id)}
                      disabled={isSoldOut}
                      className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded bg-slate-700 px-0.5 py-1 text-center text-[10px] font-semibold leading-[1.2] text-white [word-break:keep-all] active:bg-slate-800 disabled:opacity-50 sm:min-h-10 sm:px-2 sm:text-xs sm:leading-snug"
                    >
                      주문하기
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <OrderGuard
      partnerId={partner.id}
      shopClientId={client?.id}
      shopClientName={client?.name ?? undefined}
      requireAuth={false}
      blockAffiliationMismatch={false}
    >
      {content}
    </OrderGuard>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { BOTTOM_NAV_HEIGHT } from "@/components/shop/ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";

const PRIMARY = "#D6A8E0";

interface CartItem {
  id: string;
  product_id: string;
  option_json: Record<string, string> | null;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnail_url: string | null;
    base_price: number;
    sale_price: number | null;
    status: string;
    stock_qty: number;
  };
}

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;

  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;
  const partnerId = partner?.id ?? null;
  const clientId = client?.id ?? null;

  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"domestic" | "overseas">("domestic");

  useEffect(() => {
    async function loadCart() {
      if (!clientId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await shopFetch(`/api/cart?clientId=${clientId}`);
        if (res.ok) {
          const data = await res.json();
          const list = data?.items ?? [];
          setItems(list);
          setSelectedItems(new Set(list.map((item: CartItem) => item.id)));
        }
      } finally {
        setLoading(false);
      }
    }
    loadCart();
  }, [clientId]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ko-KR").format(price);

  const getItemPrice = (item: CartItem) =>
    (item.product.sale_price || item.product.base_price) * item.quantity;

  const getTotalPrice = () =>
    items
      .filter((item) => selectedItems.has(item.id))
      .reduce((sum, item) => sum + getItemPrice(item), 0);

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    const res = await shopFetch(`/api/cart/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQuantity }),
    });
    if (res.ok) {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  };

  const deleteItem = async (itemId: string) => {
    const res = await shopFetch(`/api/cart/${itemId}`, { method: "DELETE" });
    if (res.ok) {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setSelectedItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const toggleSelect = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(items.map((item) => item.id)));
  };

  const goToOrder = (selectedOnly: boolean) => {
    if (!template?.orderAllowed) {
      alert("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
      return;
    }
    const ids = selectedOnly ? Array.from(selectedItems) : items.map((i) => i.id);
    if (ids.length === 0) return;
    const query = selectedOnly ? `?items=${ids.join(",")}` : "";
    router.push(`/${subdomain}/${clientSlug}/checkout${query}`);
  };

  const isPreview = clientSlug === "_preview";

  if (template == null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6]">
        <p className="text-[#666]">로딩 중...</p>
      </div>
    );
  }

  if (!partnerId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F4F6] p-6">
        <p className="mb-4 text-[#666]">정보를 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/${clientSlug}`)}
          className="rounded-lg px-6 py-3 text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          홈으로
        </button>
      </div>
    );
  }

  if (!isPreview && !clientId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F4F6] p-6">
        <p className="mb-4 text-[#666]">정보를 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/${clientSlug}`)}
          className="rounded-lg px-6 py-3 text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          홈으로
        </button>
      </div>
    );
  }

  // 마스터 템플릿 미리보기: 주문/장바구니 불가, 빈 장바구니 UI만 표시
  if (isPreview) {
    return (
      <div className="mx-auto max-w-[430px] min-h-screen bg-white pb-28">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <p className="mb-2 text-[#333333] font-medium">마스터 템플릿 미리보기</p>
          <p className="text-[#9CA3AF] text-sm">장바구니는 거래처 전용 쇼핑몰에서만 이용할 수 있습니다.</p>
          <button
            type="button"
            onClick={() => router.push(`/${subdomain}/_preview`)}
            className="mt-6 rounded-lg px-6 py-3 text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <OrderGuard partnerId={partnerId}>
      <div className="mx-auto max-w-[430px] min-h-screen bg-white pb-28">
        {/* 탭: 국내배송상품(N) / 해외배송상품(0) */}
        <div className="flex w-full border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab("domestic")}
            className={`flex-1 py-3 text-sm font-medium ${
              tab === "domestic"
                ? "border-b-2 text-[#333333]"
                : "text-[#9CA3AF]"
            }`}
            style={
              tab === "domestic"
                ? { borderBottomColor: PRIMARY }
                : undefined
            }
          >
            국내배송상품({items.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("overseas")}
            className="flex-1 py-3 text-sm font-medium text-[#9CA3AF]"
          >
            해외배송상품(0)
          </button>
        </div>

        {/* 전체 선택 */}
        {items.length > 0 && (
          <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
            <input
              type="checkbox"
              checked={selectedItems.size === items.length}
              onChange={toggleSelectAll}
              className="h-5 w-5 cursor-pointer rounded border-gray-300"
            />
            <span className="text-sm font-medium text-[#333333]">
              전체선택 ({selectedItems.size}/{items.length})
            </span>
          </div>
        )}

        {/* 리스트 */}
        {loading ? (
          <div className="py-12 text-center text-sm text-[#9CA3AF]">
            로딩 중...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="mb-6 text-[#9CA3AF]">장바구니가 비어 있습니다</p>
            <button
              type="button"
              onClick={() => router.push(`/${subdomain}/${clientSlug}/products`)}
              className="rounded-lg px-6 py-3 text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              쇼핑 계속하기
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((item) => {
              const isSoldOut = item.product.status === "sold_out";
              return (
                <li key={item.id} className="flex gap-4 border-b border-gray-200 p-4">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    disabled={isSoldOut}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 disabled:opacity-50"
                  />
                  <div
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-[#F3F4F6]"
                    onClick={() =>
                      router.push(
                        `/${subdomain}/${clientSlug}/products/${item.product.slug}`
                      )
                    }
                  >
                    {item.product.thumbnail_url ? (
                      <img
                        src={item.product.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#9CA3AF]">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* 배송 뱃지 */}
                    <span
                      className="mb-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      당일배송
                    </span>
                    <p
                      className="line-clamp-2 text-[15px] font-normal text-[#333333]"
                      onClick={() =>
                        router.push(
                          `/${subdomain}/${clientSlug}/products/${item.product.slug}`
                        )
                      }
                    >
                      {item.product.name}
                    </p>
                    {item.option_json && (
                      <button
                        type="button"
                        className="mt-1 text-xs text-[#9CA3AF] underline"
                      >
                        옵션 변경
                      </button>
                    )}
                    <p className="mt-1 text-sm font-bold text-[#111111]">
                      {formatPrice(
                        item.product.sale_price || item.product.base_price
                      )}
                      원
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          disabled={isSoldOut || item.quantity <= 1}
                          className="flex h-8 w-8 items-center justify-center bg-white text-[#333333] hover:bg-[#F3F4F6] disabled:opacity-50"
                        >
                          −
                        </button>
                        <span className="flex h-8 min-w-[2rem] items-center justify-center border-x border-gray-200 bg-white text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          disabled={isSoldOut}
                          className="flex h-8 w-8 items-center justify-center bg-white text-[#333333] hover:bg-[#F3F4F6] disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        className="text-xs text-[#9CA3AF] hover:text-[#333333]"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Sticky 하단: 글로벌 하단 네비 바로 위에 고정 */}
        {items.length > 0 && (
          <div
            className="fixed left-0 right-0 z-50 border-t border-gray-200 bg-white p-4"
            style={{
              maxWidth: "430px",
              margin: "0 auto",
              bottom: `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_NAV_HEIGHT}px)`,
            }}
          >
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium text-[#333333]">
                총 결제예정금액
              </span>
              <span className="text-lg font-bold text-[#111111]">
                {formatPrice(getTotalPrice())}원
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => goToOrder(true)}
                disabled={selectedItems.size === 0}
                className="rounded-lg border-2 border-gray-200 py-3 text-sm font-semibold text-[#333333] hover:bg-[#F3F4F6] disabled:opacity-50"
              >
                선택상품주문
              </button>
              <button
                type="button"
                onClick={() => goToOrder(false)}
                disabled={items.length === 0}
                className="rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: PRIMARY }}
              >
                전체상품주문
              </button>
            </div>
          </div>
        )}
      </div>
    </OrderGuard>
  );
}

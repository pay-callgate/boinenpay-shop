"use client";

import { Rose } from "lucide-react";

export type OrderProductItem = {
  id: string;
  product_name: string;
  option_json: Record<string, string> | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  product: { thumbnail_url: string | null };
};

type Props = {
  items: OrderProductItem[];
  totalAmount: number;
  formatPrice: (n: number) => string;
};

export function OrderProductCard({ items, totalAmount, formatPrice }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4 text-lg font-bold text-gray-900">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-50 via-amber-50/80 to-orange-100/60 shadow-sm ring-1 ring-orange-100/80"
          aria-hidden
        >
          <Rose className="h-5 w-5 text-orange-500" strokeWidth={1.6} />
        </span>
        주문 상품 및 결제 금액
      </h2>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {item.product?.thumbnail_url ? (
                <img
                  src={item.product.thumbnail_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                  No img
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
              {item.option_json && (
                <p className="mt-0.5 text-sm text-gray-500">
                  {Object.entries(item.option_json)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ")}
                </p>
              )}
              <p className="mt-1 text-sm font-medium text-gray-500">
                {formatPrice(Number(item.unit_price))}원 × {item.quantity}개
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium text-gray-900">
                {formatPrice(Number(item.total_price))}원
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
        <span className="text-sm font-bold text-gray-900">총 결제금액</span>
        <span className="text-lg font-bold text-orange-500">
          {formatPrice(Number(totalAmount))}원
        </span>
      </div>
    </section>
  );
}

"use client";

import { Copy, Rose } from "lucide-react";

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
  orderNo: string;
  items: OrderProductItem[];
  totalAmount: number;
  formatPrice: (n: number) => string;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    alert("복사에 실패했습니다.");
  }
}

export function OrderProductCard({
  orderNo,
  items,
  totalAmount,
  formatPrice,
}: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 border-b border-gray-100 pb-4">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-900">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-50 via-amber-50/80 to-orange-100/60 shadow-sm ring-1 ring-orange-100/80"
            aria-hidden
          >
            <Rose className="h-5 w-5 text-orange-500" strokeWidth={1.6} />
          </span>
          주문 상품 및 결제 금액
        </h2>
        {/* 라벨 + 주문번호 + 복사 — 한 줄 정렬 */}
        {/* 최대 폭 기준 대비 가로 폭 약 50% (2xl → 21rem) */}
        <div className="mt-3 flex w-full max-w-[21rem] flex-nowrap items-center gap-3">
          <label
            className="shrink-0 whitespace-nowrap text-sm font-bold text-gray-900"
            htmlFor="order-detail-order-no"
          >
            주문번호
          </label>
          <div className="flex h-10 min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-gray-200 bg-slate-50 shadow-none focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/10">
            <input
              id="order-detail-order-no"
              type="text"
              readOnly
              tabIndex={-1}
              value={orderNo}
              aria-readonly="true"
              className="min-h-10 min-w-0 flex-1 overflow-hidden border-0 bg-transparent px-3 font-mono text-sm font-semibold tabular-nums tracking-wide text-slate-800 whitespace-nowrap text-ellipsis outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center border-l border-gray-200/90 bg-white/60 px-2.5 text-slate-500 transition hover:bg-white hover:text-slate-700 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
              aria-label="주문번호 복사"
              title="복사"
              onClick={() => void copyText(orderNo)}
            >
              <Copy className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </div>
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

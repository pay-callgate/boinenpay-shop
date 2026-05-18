"use client";

import React from "react";
import { Heart } from "lucide-react";

type Props = {
  categoryLabel: string | null;
  name: string;
  shortDescription: string | null;
  salePriceFormatted: string;
  basePriceFormatted: string | null;
  discountPercent: number | null;
  memberPriceFormatted: string | null;
  badges: string[];
  pointsLabel: string;
  isSoldOut: boolean;
  wishlistActive: boolean;
  wishlistBusy: boolean;
  onToggleWishlist: () => void;
};

export function ProductSummary({
  categoryLabel,
  name,
  shortDescription,
  salePriceFormatted,
  basePriceFormatted,
  discountPercent,
  memberPriceFormatted,
  badges,
  pointsLabel,
  isSoldOut,
  wishlistActive,
  wishlistBusy,
  onToggleWishlist,
}: Props) {
  return (
    <section className="px-6 pt-6 pb-4">
      {categoryLabel ? (
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{categoryLabel}</p>
      ) : (
        <p className="text-xs font-medium text-gray-400">화훼 배달</p>
      )}
      <h2 className="mt-1 text-xl font-bold leading-snug text-gray-900">{name}</h2>
      {shortDescription ? (
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{shortDescription}</p>
      ) : null}

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            {discountPercent != null && discountPercent > 0 ? (
              <span className="font-montserrat text-lg font-bold tabular-nums text-orange-500">
                {discountPercent}%
              </span>
            ) : null}
            <p className="font-montserrat text-2xl font-bold tabular-nums text-orange-600">
              {salePriceFormatted}
              <span className="ml-0.5 text-lg font-bold">원</span>
            </p>
            {basePriceFormatted ? (
              <span className="font-montserrat text-sm tabular-nums text-gray-400 line-through">
                {basePriceFormatted}원
              </span>
            ) : null}
          </div>
          {memberPriceFormatted ? (
            <p className="mt-2 text-sm text-gray-600">
              회원특가{" "}
              <span className="font-montserrat font-bold tabular-nums text-orange-600">
                {memberPriceFormatted}원
              </span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleWishlist}
          disabled={wishlistBusy}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 transition-colors hover:border-gray-300 active:bg-gray-50 disabled:opacity-50"
          aria-label="관심상품"
        >
          <Heart
            className="size-5"
            strokeWidth={1.75}
            fill={wishlistActive ? "currentColor" : "none"}
            style={{ color: wishlistActive ? "#f97316" : undefined }}
          />
        </button>
      </div>

      {badges.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((b) => (
            <span
              key={b}
              className="inline-flex min-h-9 items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700"
            >
              {b}
            </span>
          ))}
          <span className="inline-flex min-h-9 items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800">
            {pointsLabel}
          </span>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex min-h-9 items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800">
            {pointsLabel}
          </span>
        </div>
      )}

      {isSoldOut ? (
        <p className="mt-4 rounded-xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-800">
          품절된 상품입니다.
        </p>
      ) : null}
    </section>
  );
}

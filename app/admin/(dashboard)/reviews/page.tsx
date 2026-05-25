"use client";

import { Star } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

/**
 * 리뷰 관리 — 리스트 레이아웃 스캐폴드
 * /admin/reviews
 */
export default function ReviewsPage() {
  const reviews: Array<{
    id: string;
    productName: string;
    clientName: string;
    authorName: string;
    rating: number;
    status: string;
    createdAt: string;
  }> = [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 px-4 py-4 sm:p-6">
      <div className="shrink-0">
        <AdminPageHeader
          eyebrow="Board · Reviews"
          title="리뷰 관리"
          titleIcon={Star}
          description="쇼핑몰 상품 리뷰를 조회·검수하고 응대할 수 있도록 준비하고 있습니다."
        />

        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="상품명, 거래처, 작성자 검색..."
              disabled
              className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-400 sm:min-w-[220px] sm:flex-initial"
              aria-label="리뷰 검색"
            />
            <button
              type="button"
              disabled
              className="h-10 shrink-0 rounded-md border border-slate-300 bg-slate-100 px-4 text-sm font-medium text-slate-400"
            >
              검색
            </button>
          </div>
        </div>

        <p className="mb-3 text-sm text-slate-600">총 {reviews.length}개 리뷰</p>
      </div>

      <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="scrollbar-thin flex-1 overflow-y-auto pb-4 md:hidden">
          <div className="space-y-3 p-3">
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">등록된 리뷰가 없습니다.</p>
                <p className="mt-1 text-xs text-slate-500">
                  리뷰 수집 기능이 연결되면 이곳에 카드 형태로 표시됩니다.
                </p>
              </div>
            ) : (
              reviews.map((review) => (
                <article key={review.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{review.productName}</p>
                      <p className="mt-1 text-xs text-slate-500">{review.clientName}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {review.rating}점
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">
                    {review.authorName} · {review.createdAt}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="scrollbar-thin hidden min-h-0 flex-1 overflow-y-auto pb-4 md:flex md:flex-col">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">상품</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">거래처</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">작성자</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">평점</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">작성일</th>
              </tr>
            </thead>
            <tbody>
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    등록된 리뷰가 없습니다.
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{review.productName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{review.clientName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{review.authorName}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-amber-700">{review.rating}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{review.status}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{review.createdAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

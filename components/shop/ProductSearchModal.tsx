"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { getShopHomeHref } from "@/lib/shop-home-nav";

const PRIMARY = "#D6A8E0";

/** 인기/추천 검색 키워드 (실제 데이터 연동 시 API 또는 props로 교체) */
const SUGGESTED_KEYWORDS = ["꽃다발", "축하화환", "근조화환", "동양란"];

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  subdomain: string;
  clientSlug: string | null;
}

/**
 * 헤더/사이드메뉴 검색 클릭 시 열리는 상품 검색 모달.
 * Glassmorphism, 풀와이드 상단 밀착, 추천 키워드 태그.
 */
export function ProductSearchModal({
  isOpen,
  onClose,
  subdomain,
  clientSlug,
}: ProductSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const base = getShopHomeHref(subdomain, clientSlug);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    onClose();
    if (q) {
      router.push(`${base}/products?search=${encodeURIComponent(q)}`);
    } else {
      router.push(`${base}/products`);
    }
  };

  const handleKeywordClick = (keyword: string) => {
    setQuery(keyword);
    onClose();
    router.push(`${base}/products?search=${encodeURIComponent(keyword)}`);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Glassmorphism 오버레이: 강한 블러 + 연한 어둡기 */}
      <div
        className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-md transition-opacity"
        role="presentation"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* 풀와이드 상단 밀착 모달 */}
      <div
        className="fixed left-0 right-0 top-0 z-[201] mx-auto max-w-[430px] rounded-b-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="상품 검색"
      >
        <form onSubmit={handleSubmit} className="p-4">
          {/* 검색창: 테두리 없음, 연한 그레이 배경, 아이콘 통합 */}
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
            <Search
              strokeWidth={1.5}
              className="h-4 w-4 shrink-0 text-gray-400"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="상품명으로 검색"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              autoComplete="off"
              aria-label="검색어"
            />
            {query.trim() ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200/80 hover:text-gray-600"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button
                  type="submit"
                  className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-white transition-opacity active:opacity-90"
                  style={{ backgroundColor: PRIMARY }}
                  aria-label="검색"
                >
                  검색
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200/80 hover:text-gray-600"
                aria-label="닫기"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* 추천 키워드: 자그마한 태그 */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-gray-500">인기 검색어</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_KEYWORDS.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => handleKeywordClick(keyword)}
                  className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-200 active:opacity-80"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

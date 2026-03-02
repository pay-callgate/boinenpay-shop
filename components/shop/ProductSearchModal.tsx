"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

const PRIMARY = "#D6A8E0";

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  subdomain: string;
  clientSlug: string | null;
}

/**
 * 헤더 검색 아이콘 클릭 시 열리는 상품 검색 모달.
 * 검색어 입력 후 제출 시 /products?search=xxx 로 이동.
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
  const base = clientSlug ? `/${subdomain}/${clientSlug}` : `/${subdomain}`;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    onClose();
    if (q) {
      router.push(`${base}/products?search=${encodeURIComponent(q)}`);
    } else {
      router.push(`${base}/products`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 pt-[72px] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="상품 검색"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[430px] rounded-xl overflow-hidden bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Search strokeWidth={1.5} className="h-5 w-5 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="상품명으로 검색"
            className="flex-1 min-w-0 py-2 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
            autoComplete="off"
            aria-label="검색어"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            type="submit"
            className="w-full rounded-lg py-3 text-base font-medium text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            검색
          </button>
        </div>
      </form>
    </div>
  );
}

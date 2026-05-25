"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronDown, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductRegistrationModal } from "@/components/admin/ProductRegistrationModal";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * T2-2: 상품 목록 페이지 (모바일 쇼핑몰 Admin UI)
 * 테이블 스타일링, 필터 한 줄, 상태 뱃지, 가격/썸네일 강조
 */

interface Product {
  id: string;
  partner_id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  base_price: number;
  sale_price: number | null;
  stock_qty: number;
  safety_stock: number;
  status: string;
  created_at: string;
  product_category_mappings?: {
    category_id: string;
    product_categories: { id: string; name: string };
  }[];
}

interface Category {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [partnerSubdomain, setPartnerSubdomain] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  /** 짧은 뷰포트에서 필터 부피 압축 (기본 접힘) */
  const [filterDetailExpanded, setFilterDetailExpanded] = useState(false);

  const LIMIT = 10;

  useEffect(() => {
    async function fetchPartner() {
      const res = await adminFetch("/api/partner");
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.id) {
          setPartnerId(result.data.id);
          setPartnerSubdomain(result.data.subdomain ?? "");
        } else setPartnerId(null);
      }
    }
    fetchPartner();
  }, []);

  const fetchCategories = useCallback(async () => {
    if (!partnerId) return;
    try {
      const res = await adminFetch(`/api/categories?partnerId=${partnerId}`);
      if (!res.ok) {
        // 실패 시 기존 categories 상태는 그대로 유지
        return;
      }
      const data = await res.json();
      if (Array.isArray(data?.flat)) {
        setCategories(data.flat);
      }
    } catch {
      // 네트워크 오류 등도 기존 상태 유지
    }
  }, [partnerId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchProducts = useCallback(
    async (pageOverride?: number) => {
      if (!partnerId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const pageToUse = pageOverride ?? page;
      const params = new URLSearchParams({
        partnerId,
        page: pageToUse.toString(),
        limit: LIMIT.toString(),
      });
      if (search) params.append("search", search);
      if (categoryId) params.append("categoryId", categoryId);
      if (status) params.append("status", status);

      try {
        const res = await adminFetch(`/api/products?${params}`);
        if (!res.ok) {
          // 실패 시 기존 products/pagination 상태는 그대로 유지
          return;
        }
        const data = await res.json();
        if (Array.isArray(data?.products)) {
          setProducts(data.products);
        }
        const totalFromApi = typeof data?.pagination?.total === "number" ? data.pagination.total : total;
        const totalPagesFromApi =
          typeof data?.pagination?.totalPages === "number"
            ? data.pagination.totalPages
            : Math.max(1, Math.ceil(totalFromApi / LIMIT));
        setTotal(totalFromApi);
        setTotalPages(totalPagesFromApi);
      } catch {
        // 네트워크 오류 등도 기존 상태 유지
      } finally {
        setLoading(false);
      }
    },
    [partnerId, page, search, categoryId, status, total]
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await adminFetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) fetchProducts();
    else {
      const data = await res.json();
      alert(data.error || "삭제 실패");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts(1);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ko-KR").format(price) + "원";

  const isLowStock = (p: Product) => p.stock_qty <= p.safety_stock;

  const getStatusBadgeForProduct = (p: Product) => {
    if (p.status === "sold_out") return <Badge variant="sold_out">품절</Badge>;
    if (p.status === "draft") return <Badge variant="draft">임시저장</Badge>;
    if (p.status === "inactive") return <Badge variant="inactive">비활성</Badge>;
    if (isLowStock(p)) return <Badge variant="sold_out">재고부족</Badge>;
    return <Badge variant="active">판매중</Badge>;
  };

  const categoryLabelForProduct = (p: Product) =>
    p.product_category_mappings?.map((m) => m.product_categories?.name).filter(Boolean).join(", ") || "-";

  return (
    <>
      <ProductRegistrationModal
        open={registrationModalOpen}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null);
          setRegistrationModalOpen(open);
        }}
        partnerId={partnerId}
        subdomain={partnerSubdomain}
        initialData={editingProduct}
        onSuccess={fetchProducts}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 px-4 py-4 sm:p-6">
        {/* 상단 고정: 타이틀·필터·총 상품 수 (스크롤 시 찌그러짐 방지) */}
        <div className="shrink-0">
          <AdminPageHeader
            eyebrow="Catalog · Products"
            title="상품 관리"
            titleIcon={Package}
            description={
              <span className="break-keep [word-break:keep-all]">
                등록된 상품을 검색과 필터로 빠르게 찾고, 가격·재고·판매 상태를 관리합니다. 우측 상단의 [+ 상품 등록] 버튼을 통해 새로운 상품을 추가할 수 있습니다.
              </span>
            }
          />

          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <form onSubmit={handleSearch}>
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="상품명 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-md border border-gray-200 bg-slate-50 px-3 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 sm:min-w-[200px] sm:flex-initial"
                />
                <button
                  type="submit"
                  className="h-10 shrink-0 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  검색
                </button>
                <button
                  type="button"
                  onClick={() => setFilterDetailExpanded((v) => !v)}
                  className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold whitespace-nowrap transition-colors sm:text-sm ${
                    filterDetailExpanded
                      ? "border-slate-900 bg-white text-slate-900"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  aria-expanded={filterDetailExpanded}
                >
                  <Calendar className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                  카테고리·상태
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                      filterDetailExpanded ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  />
                </button>
                <div className="ml-auto flex shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setRegistrationModalOpen(true);
                    }}
                    className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90"
                    style={{ backgroundColor: "#1e293b" }}
                  >
                    + 상품 등록
                  </button>
                </div>
              </div>
              {filterDetailExpanded ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                  >
                    <option value="">전체 카테고리</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                  >
                    <option value="">전체 상태</option>
                    <option value="active">판매중</option>
                    <option value="draft">임시저장</option>
                    <option value="sold_out">품절</option>
                    <option value="inactive">비활성</option>
                  </select>
                </div>
              ) : null}
            </form>
          </div>

          <p className="mb-3 text-sm text-slate-600">총 {total}개 상품</p>
        </div>

        {/* 테이블 & 페이징: 최소 높이 방어 · 모바일 카드 */}
        <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="scrollbar-thin flex-1 overflow-y-auto pb-4 md:hidden">
            <div className="space-y-3 p-3">
              {loading ? (
                <p className="py-12 text-center text-sm text-slate-500">불러오는 중…</p>
              ) : products.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">등록된 상품이 없습니다.</p>
              ) : (
                products.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex gap-3">
                      {p.thumbnail_url ? (
                        <img
                          src={p.thumbnail_url}
                          alt={p.name}
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-400">
                          No img
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800">{p.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{categoryLabelForProduct(p)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {getStatusBadgeForProduct(p)}
                          <span
                            className={`text-sm font-medium ${isLowStock(p) ? "text-red-600" : "text-slate-700"}`}
                          >
                            재고 {p.stock_qty}
                          </span>
                        </div>
                        <div className="mt-2 text-right">
                          {p.sale_price != null && p.sale_price !== p.base_price && (
                            <span className="mr-2 text-xs text-slate-400 line-through">
                              {formatPrice(p.base_price)}
                            </span>
                          )}
                          <span className="text-base font-bold text-red-500">
                            {p.sale_price != null ? formatPrice(p.sale_price) : formatPrice(p.base_price)}
                          </span>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p);
                              setRegistrationModalOpen(true);
                            }}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="scrollbar-thin hidden min-h-0 flex-1 overflow-y-auto pb-4 md:flex md:flex-col">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_#e2e8f0]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">상품</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">카테고리</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">가격</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">재고</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">상태</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    등록된 상품이 없습니다.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.thumbnail_url ? (
                          <img
                            src={p.thumbnail_url}
                            alt={p.name}
                            className="h-16 w-16 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-400">
                            No img
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-500">{categoryLabelForProduct(p)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {categoryLabelForProduct(p)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        {p.sale_price != null && p.sale_price !== p.base_price && (
                          <span className="text-xs text-slate-400 line-through">
                            {formatPrice(p.base_price)}
                          </span>
                        )}
                        <span className="font-bold text-red-500">
                          {p.sale_price != null
                            ? formatPrice(p.sale_price)
                            : formatPrice(p.base_price)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-medium ${
                          isLowStock(p) ? "text-red-600" : "text-slate-700"
                        }`}
                      >
                        {p.stock_qty}
                      </span>
                      {isLowStock(p) && (
                        <span className="block text-xs text-red-600">⚠ 재고 부족</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadgeForProduct(p)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(p);
                            setRegistrationModalOpen(true);
                          }}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이징 영역: 테이블 카드 하단에 통합 (거래처/링크 관리와 동일) */}
        {!loading && total > 0 && (
          <div className="flex shrink-0 flex-col items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
              <div
                className="absolute top-0 h-full rounded-full bg-slate-600 transition-all duration-200"
                style={{
                  width: `${totalPages > 0 ? 100 / totalPages : 0}%`,
                  left: `${totalPages > 0 ? ((page - 1) / totalPages) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="맨 처음"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="이전"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="min-w-[4rem] text-center text-sm font-medium text-slate-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="다음"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
              aria-label="맨 끝"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

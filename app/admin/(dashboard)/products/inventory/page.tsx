"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * T2-4: 재고 관리 페이지
 * - quantity, safety_stock 수정
 * - 고급스러운 UI: 대시보드 카드, 필터 탭, 테이블 고도화, 페이징
 */

interface Product {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  stock_qty: number;
  safety_stock: number;
  status: string;
  product_category_mappings?: {
    category_id: string;
    product_categories: { id: string; name: string };
  }[];
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low">("all");

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ stockQty: 0, safetyStock: 0 });

  useEffect(() => {
    async function fetchPartner() {
      const res = await fetch("/api/partner");
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.id) setPartnerId(result.data.id);
        else setPartnerId(null);
      }
    }
    fetchPartner();
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!partnerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/products?partnerId=${partnerId}&limit=100`);
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products || []);
    }
    setLoading(false);
  }, [partnerId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts =
    filter === "low"
      ? products.filter((p) => p.stock_qty <= p.safety_stock)
      : products;

  const clientTotalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  );
  const displayedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const handleSave = async (productId: string) => {
    const res = await fetch(`/api/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stockQty: editValues.stockQty,
        safetyStock: editValues.safetyStock,
      }),
    });

    if (res.ok) {
      setEditingId(null);
      fetchProducts();
    } else {
      alert("저장 실패");
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditValues({ stockQty: p.stock_qty, safetyStock: p.safety_stock });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ stockQty: 0, safetyStock: 0 });
  };

  const isLowStock = (p: Product) => p.stock_qty <= p.safety_stock;
  const lowStockCount = products.filter((p) => p.stock_qty <= p.safety_stock).length;
  const normalCount = products.length - lowStockCount;

  const categoryNames = (p: Product) =>
    p.product_category_mappings
      ?.map((m) => m.product_categories?.name)
      .filter(Boolean)
      .join(", ") || "-";

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50 p-6">
      {/* 상단 고정: 타이틀·대시보드·필터 (스크롤 시 찌그러짐 방지) */}
      <div className="shrink-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">재고 관리</h1>
          <p className="mt-1 text-sm text-slate-600">
            재고 수량과 안전 재고를 확인하고 수정할 수 있습니다.
          </p>
        </div>

        {/* 1. 상단 요약 대시보드 (Dashboard Card) - Soft Pink Theme */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-rose-100 bg-rose-50 shadow-sm">
          <CardContent className="flex h-24 min-h-[6rem] items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-rose-500 shadow-sm">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8 4-8-4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-rose-600">전체 상품</p>
              <p className="text-3xl font-bold text-rose-950">{products.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-rose-100 bg-rose-50 shadow-sm">
          <CardContent className="flex h-24 min-h-[6rem] items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-rose-500 shadow-sm">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-rose-600">정상 재고</p>
              <p className="text-3xl font-bold text-rose-950">{normalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-white shadow-sm">
          <CardContent className="flex h-24 min-h-[6rem] items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 shadow-sm">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-red-600">재고 부족</p>
              <p className="text-3xl font-bold text-red-600">{lowStockCount}</p>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* 2. 필터 탭 (Tabs 스타일) */}
        <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm w-fit">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            전체 ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("low")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              filter === "low"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            재고 부족 ({lowStockCount})
          </button>
        </div>
      </div>

      {/* 테이블 & 페이징: 남는 공간 전부 채움, 본문만 스크롤 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full border-collapse relative">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm shadow-[0_1px_0_#e2e8f0]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                  상품
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                  재고
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                  상태
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    로딩 중...
                  </td>
                </tr>
              ) : displayedProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    {filter === "low"
                      ? "재고 부족 상품이 없습니다."
                      : "등록된 상품이 없습니다."}
                  </td>
                </tr>
              ) : (
                displayedProducts.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-100 transition-colors hover:bg-slate-50/50 ${
                      isLowStock(p) ? "bg-red-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.thumbnail_url ? (
                          <img
                            src={p.thumbnail_url}
                            alt={p.name}
                            className="h-12 w-12 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-200 text-xs text-slate-400">
                            No img
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-500">
                            {categoryNames(p)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingId === p.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            value={editValues.stockQty}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                stockQty: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            min={0}
                            className="h-9 w-20 rounded-md border border-slate-300 px-2 text-center text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                          />
                          <span className="text-slate-400">/</span>
                          <input
                            type="number"
                            value={editValues.safetyStock}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                safetyStock: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            min={0}
                            className="h-9 w-20 rounded-md border border-slate-300 px-2 text-center text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                          />
                        </div>
                      ) : (
                        <span>
                          <span
                            className={`text-lg font-bold ${
                              isLowStock(p) ? "text-red-600" : "text-slate-700"
                            }`}
                          >
                            {p.stock_qty}
                          </span>
                          <span className="ml-1.5 text-sm text-slate-500">
                            (안전재고: {p.safety_stock}개)
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isLowStock(p) ? (
                        <Badge variant="sold_out">재고 부족</Badge>
                      ) : (
                        <Badge variant="active">정상</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        {editingId === p.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSave(p.id)}
                              className="rounded-md border border-slate-300 bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            수정
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이징 영역: 테이블 카드 하단에 통합 */}
        {!loading && filteredProducts.length > 0 && (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-col items-center gap-2">
            <div className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
              <div
                className="absolute top-0 h-full rounded-full bg-slate-600 transition-all duration-200"
                style={{
                  width: `${100 / clientTotalPages}%`,
                  left: `${((currentPage - 1) / clientTotalPages) * 100}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                aria-label="맨 처음"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                aria-label="이전"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="min-w-[4rem] text-center text-sm font-medium text-slate-700">
                {currentPage} / {clientTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(clientTotalPages, p + 1))}
                disabled={currentPage >= clientTotalPages}
                className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                aria-label="다음"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(clientTotalPages)}
                disabled={currentPage >= clientTotalPages}
                className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
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
  );
}

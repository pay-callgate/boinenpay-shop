"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * T2-1: 카테고리 관리 페이지 (모던 SaaS 스타일)
 * /admin/categories (중앙 집중형)
 * 좌측 리스트 + 우측 폼, 컴팩트 레이아웃, 한 화면 맞춤
 */

interface Category {
  id: string;
  partner_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  sort_order: number;
  mobile_visible?: boolean | null;
  created_at: string;
  children?: Category[];
}

function GripVerticalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </svg>
  );
}

const inputClass =
  "h-9 w-full rounded-md border border-slate-200 px-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [flatCategories, setFlatCategories] = useState<Category[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    parentId: "",
    sortOrder: 0,
  });
  const [mobileVisible, setMobileVisible] = useState(true);

  useEffect(() => {
    async function fetchPartner() {
      const res = await adminFetch("/api/partner");
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.id) setPartnerId(result.data.id);
        else setPartnerId(null);
      }
    }
    fetchPartner();
  }, []);

  const fetchCategories = useCallback(async () => {
    if (!partnerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await adminFetch(`/api/categories?partnerId=${partnerId}`);
      if (!res.ok) {
        setError("카테고리 조회 실패");
        // 실패 시 기존 categories/flatCategories 상태는 유지
      } else {
        const data = await res.json();
        if (Array.isArray(data?.categories)) {
          setCategories(data.categories);
        }
        if (Array.isArray(data?.flat)) {
          setFlatCategories(data.flat);
        }
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId || !formData.name.trim()) return;

    const url = editingCategory
      ? `/api/categories/${editingCategory.id}`
      : "/api/categories";
    const method = editingCategory ? "PUT" : "POST";

    const res = await adminFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId,
        name: formData.name.trim(),
        slug: formData.slug.trim() || undefined,
        parentId: formData.parentId || null,
        sortOrder: formData.sortOrder,
        mobileVisible,
      }),
    });

    if (res.ok) {
      resetForm();
      fetchCategories();
    } else {
      const data = await res.json();
      alert(data.error || "저장 실패");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await adminFetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      resetForm();
      fetchCategories();
    } else {
      const data = await res.json();
      alert(data.error || "삭제 실패");
    }
  };

  const handleSelect = (cat: Category) => {
    setSelectedId(cat.id);
    setEditingCategory(cat);
    setMobileVisible(cat.mobile_visible !== false);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parent_id || "",
      sortOrder: cat.sort_order,
    });
  };

  const resetForm = () => {
    setSelectedId(null);
    setEditingCategory(null);
    setMobileVisible(true);
    setFormData({ name: "", slug: "", parentId: "", sortOrder: 0 });
  };

  const handleAddNew = () => {
    setSelectedId(null);
    setEditingCategory(null);
    setMobileVisible(true);
    setFormData({ name: "", slug: "", parentId: "", sortOrder: flatCategories.length });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-500"></p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">카테고리 관리</h1>
        <p className="text-sm text-slate-500 mt-0.5">카테고리를 추가·수정합니다.</p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 좌측: 카테고리 목록 카드 */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-700">카테고리 목록</h2>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {categories.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">등록된 카테고리가 없습니다.</p>
            ) : (
              <ul className="space-y-0.5">
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(cat)}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        selectedId === cat.id
                          ? "bg-slate-100 text-blue-600"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="shrink-0 text-slate-400">
                        <GripVerticalIcon />
                      </span>
                      <span className="font-medium">{cat.name}</span>
                    </button>
                    {cat.children && cat.children.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5 pl-6">
                        {cat.children.map((child) => (
                          <li key={child.id}>
                            <button
                              type="button"
                              onClick={() => handleSelect(child)}
                              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                selectedId === child.id
                                  ? "bg-slate-100 text-blue-600"
                                  : "text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <span className="shrink-0 text-slate-400">
                                <GripVerticalIcon />
                              </span>
                              <span>{child.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 우측: 폼 카드 (컴팩트) */}
        <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-700">
              {editingCategory ? "카테고리 수정" : "카테고리 추가"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-4">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>카테고리명 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Slug (비워두면 자동생성)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className={inputClass}
                />
              </div>
              {/* 상위 카테고리 + 정렬 순서 한 줄 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>상위 카테고리</label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">없음 (최상위)</option>
                    {flatCategories
                      .filter((c) => !c.parent_id && c.id !== editingCategory?.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>정렬 순서</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              {/* 모바일 노출 - 한 줄 슬림 */}
              <div className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-slate-700">모바일 노출</span>
                  <p className="text-xs text-slate-500">끄면 메뉴에서 숨깁니다</p>
                </div>
                <Switch checked={mobileVisible} onCheckedChange={setMobileVisible} />
              </div>

              {/* 대표 이미지 - 슬림 높이 */}
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-600">대표 이미지</p>
                <div className="flex h-14 min-h-[56px] items-center justify-center rounded border border-dashed border-slate-200 bg-white">
                  <p className="text-xs text-slate-400">드래그 또는 클릭하여 업로드</p>
                </div>
              </div>
            </div>

            {/* 폼 하단: 저장 / 삭제 / 취소 */}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="submit"
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
              >
                카테고리 저장
              </button>
              {editingCategory && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingCategory.id)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

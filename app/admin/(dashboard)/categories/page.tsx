"use client";

import { useState, useEffect, useCallback, type FormEvent, type ReactNode } from "react";
import {
  FolderPlus,
  FolderTree,
  Link2,
  List,
  ListOrdered,
  Pencil,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { adminFetch } from "@/lib/admin-fetch";
import {
  ADMIN_MODAL_PRIMARY_BTN_CLASS,
  ADMIN_MODAL_CANCEL_BTN_CLASS,
} from "@/lib/admin-dialog-policy";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

/**
 * T2-1: 카테고리 관리 페이지 (모던 SaaS 스타일)
 * /admin/categories (중앙 집중형)
 * 좌측 리스트 + 우측 폼, 컴팩트 레이아웃, 한 화면 맞춤
 */

/** 상단 페이지 헤더와 톤을 맞춘 패널 헤더 (그라데이션·테두리) */
const categoryPanelHeaderClass =
  "border-b border-slate-200/80 bg-gradient-to-br from-sky-50/40 via-white to-emerald-50/40 px-5 py-3.5 sm:px-6";

interface Category {
  id: string;
  partner_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  sort_order: number;
  mobile_visible?: boolean | null;
  default_template_id?: string | null;
  created_at: string;
  children?: Category[];
}

interface InfoTemplateOption {
  id: string;
  name: string;
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

function InputLeadingIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 [&_svg]:size-4"
      aria-hidden
    >
      {children}
    </span>
  );
}

/** 폼 하단 액션: 「카테고리 저장」 너비 기준으로 통일 */
const categoryFormActionBtnWidthClass =
  "inline-flex min-w-[12rem] justify-center";

/** 거래처 등록/수정 모달과 동일 톤 */
const inputClass =
  "h-10 w-full rounded-md border border-gray-200 bg-slate-50 px-3 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10";
const inputWithIconClass = `${inputClass} pl-9`;
const selectClass = `${inputClass} cursor-pointer py-0 pr-8`;
const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";

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
    defaultTemplateId: "",
  });
  const [mobileVisible, setMobileVisible] = useState(true);
  const [infoTemplates, setInfoTemplates] = useState<InfoTemplateOption[]>([]);

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

  useEffect(() => {
    async function loadTemplates() {
      if (!partnerId) return;
      const res = await adminFetch(`/api/info-templates?partnerId=${partnerId}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.templates) ? data.templates : [];
      setInfoTemplates(
        list.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))
      );
    }
    void loadTemplates();
  }, [partnerId]);

  const handleSubmit = async (e: FormEvent) => {
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
        defaultTemplateId: formData.defaultTemplateId || null,
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
      defaultTemplateId: cat.default_template_id || "",
    });
  };

  const resetForm = () => {
    setSelectedId(null);
    setEditingCategory(null);
    setMobileVisible(true);
    setFormData({ name: "", slug: "", parentId: "", sortOrder: 0, defaultTemplateId: "" });
  };

  const handleAddNew = () => {
    setSelectedId(null);
    setEditingCategory(null);
    setMobileVisible(true);
    setFormData({ name: "", slug: "", parentId: "", sortOrder: flatCategories.length, defaultTemplateId: "" });
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
      <AdminPageHeader
        eyebrow="Catalog · Categories"
        title="카테고리 관리"
        titleIcon={FolderTree}
        description={
          <span className="break-keep [word-break:keep-all]">
            쇼핑몰의 상품별 카테고리를{" "}
            <strong className="font-semibold text-emerald-800">신규 등록</strong>하고,{" "}
            <strong className="font-semibold text-emerald-800">노출 순서</strong> 등
            카테고리 정보를{" "}
            <strong className="font-semibold text-emerald-800">수정 관리</strong>합니다.
          </span>
        }
      />

      {error && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 좌측: 카테고리 목록 카드 */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className={categoryPanelHeaderClass}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90 sm:text-xs">
              Categories · List
            </p>
            <h2 className="mt-0.5 flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              <List
                className="h-5 w-5 shrink-0 text-emerald-600 sm:h-5 sm:w-5"
                strokeWidth={1.75}
                aria-hidden
              />
              카테고리 목록
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              항목을 선택하면 오른쪽 패널에서 상세를 편집할 수 있습니다.
            </p>
          </div>
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-3 sm:p-4">
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
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm lg:col-span-2">
          <div className={categoryPanelHeaderClass}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90 sm:text-xs">
              {editingCategory ? "Categories · Edit" : "Categories · New"}
            </p>
            <h2 className="mt-0.5 flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {editingCategory ? (
                <Pencil
                  className="h-5 w-5 shrink-0 text-emerald-600"
                  strokeWidth={1.75}
                  aria-hidden
                />
              ) : (
                <FolderPlus
                  className="h-5 w-5 shrink-0 text-emerald-600"
                  strokeWidth={1.75}
                  aria-hidden
                />
              )}
              {editingCategory ? "카테고리 수정" : "카테고리 추가"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {editingCategory
                ? "선택한 카테고리 정보를 저장하면 쇼핑몰에 반영됩니다."
                : "새 카테고리를 등록한 뒤 목록에서 순서·노출을 조정할 수 있습니다."}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-4 sm:p-5">
            <div className="space-y-5">
              <div>
                <label className={labelClass} htmlFor="cat-name">
                  카테고리명 <span className="font-semibold text-red-500">*</span>
                </label>
                <div className="relative">
                  <InputLeadingIcon>
                    <FolderTree />
                  </InputLeadingIcon>
                  <input
                    id="cat-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="카테고리 이름"
                    className={inputWithIconClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="cat-slug">
                  Slug{" "}
                  <span className="font-normal text-slate-400">
                    (비워두면 카테고리 이름으로 주소가 자동 생성됩니다)
                  </span>
                </label>
                <div className="relative">
                  <InputLeadingIcon>
                    <Link2 />
                  </InputLeadingIcon>
                  <input
                    id="cat-slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="url-slug"
                    className={inputWithIconClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <label className={labelClass} htmlFor="cat-parent">
                    상위 카테고리
                  </label>
                  <select
                    id="cat-parent"
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">없음 (최상위)</option>
                    {flatCategories
                      .filter((c) => !c.parent_id && c.id !== editingCategory?.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="cat-sort">
                    정렬 순서
                  </label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <ListOrdered />
                    </InputLeadingIcon>
                    <input
                      id="cat-sort"
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) =>
                        setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                      }
                      className={inputWithIconClass}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-gray-200 bg-slate-50 px-3 py-2.5">
                <div>
                  <span className="text-sm font-medium text-slate-700">모바일 노출</span>
                  <p className="text-xs text-slate-500">비활성화 시 쇼핑몰 메뉴에서 숨겨집니다</p>
                </div>
                <Switch checked={mobileVisible} onCheckedChange={setMobileVisible} />
              </div>

              <div>
                <label className={labelClass} htmlFor="cat-template">
                  상세페이지 공통 안내 설정
                </label>
                <select
                  id="cat-template"
                  value={formData.defaultTemplateId}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultTemplateId: e.target.value })
                  }
                  className={selectClass}
                >
                  <option value="">없음</option>
                  {infoTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div className="mt-1.5 space-y-1 text-xs text-slate-500">
                  <p>
                    선택한 템플릿이 이 카테고리 상품들의 배송/환불 안내에 기본으로 적용됩니다.
                  </p>
                  <p>
                    ※ 새로운 템플릿은 [공통 안내 관리] 메뉴에서 등록할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
              <button
                type="submit"
                className={`${ADMIN_MODAL_PRIMARY_BTN_CLASS} ${categoryFormActionBtnWidthClass}`}
              >
                카테고리 저장
              </button>
              {editingCategory && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingCategory.id)}
                  className={`rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 ${categoryFormActionBtnWidthClass}`}
                >
                  삭제
                </button>
              )}
              <button
                type="button"
                onClick={resetForm}
                className={`${ADMIN_MODAL_CANCEL_BTN_CLASS} ${categoryFormActionBtnWidthClass}`}
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

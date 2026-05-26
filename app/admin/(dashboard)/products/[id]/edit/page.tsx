"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Package } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { PRODUCT_IMAGE_UPLOAD_NOTICE } from "@/lib/product-image-guidance";
import { ProductPolicyFormSection } from "@/components/admin/ProductPolicyFormSection";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

/**
 * T2-3: 상품 수정 페이지
 */

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
}

interface Product {
  id: string;
  partner_id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description_html: string | null;
  thumbnail_url: string | null;
  base_price: number;
  sale_price: number | null;
  stock_qty: number;
  safety_stock: number;
  status: string;
  allow_delivery_date: boolean;
  policy_source?: string | null;
  override_template_id?: string | null;
  custom_policy_data?: {
    delivery_info?: string;
    refund_policy?: string;
    product_notice?: string;
  } | null;
  newrun_default_product_draft?: Record<string, unknown> | null;
  newrun_default_option_draft?: Record<string, unknown> | null;
  product_category_mappings?: {
    category_id: string;
    is_primary?: boolean | null;
  }[];
}

function parseNewrunDraftJsonField(
  raw: string,
  fieldLabel: string
): Record<string, unknown> | null {
  const t = raw.trim();
  if (t === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    throw new Error(`${fieldLabel}: JSON 파싱 실패`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel}: 최상위는 객체여야 합니다.`);
  }
  const o = parsed as Record<string, unknown>;
  if (Object.keys(o).length === 0) return null;
  return o;
}

export default function ProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [infoTemplates, setInfoTemplates] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    shortDescription: "",
    descriptionHtml: "",
    thumbnailUrl: "",
    basePrice: 0,
    salePrice: "",
    stockQty: 0,
    safetyStock: 0,
    status: "draft",
    allowDeliveryDate: false,
    categoryIds: [] as string[],
    policySource: "category_default" as
      | "category_default"
      | "template"
      | "custom",
    overrideTemplateId: "",
    primaryCategoryId: "",
    customDelivery: "",
    customRefund: "",
    customNotice: "",
    /** T3.4: 뉴런 협회 상품·옵션 검색 기본 payload (JSON 객체) */
    newrunProductDraftJson: "{}",
    newrunOptionDraftJson: "{}",
  });

  // 파트너 정보 조회
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

  // 카테고리 목록 조회
  useEffect(() => {
    async function fetchCategories() {
      if (!partnerId) return;
      const res = await adminFetch(`/api/categories?partnerId=${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.flat || []);
      }
    }
    fetchCategories();
  }, [partnerId]);

  useEffect(() => {
    async function fetchInfoTemplates() {
      if (!partnerId) return;
      const res = await adminFetch(`/api/info-templates?partnerId=${partnerId}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.templates) ? data.templates : [];
      setInfoTemplates(
        list.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))
      );
    }
    fetchInfoTemplates();
  }, [partnerId]);

  // 상품 정보 조회
  useEffect(() => {
    async function fetchProduct() {
      if (!productId) return;
      const res = await adminFetch(`/api/products/${productId}`);
      if (res.ok) {
        const data = await res.json();
        const p: Product = data.product;
        const maps = p.product_category_mappings ?? [];
        const primaryRow = maps.find((m) => m.is_primary);
        const primaryCategoryId =
          primaryRow?.category_id ?? maps[0]?.category_id ?? "";
        const src = p.policy_source;
        const policySource =
          src === "template" || src === "custom" || src === "category_default"
            ? src
            : "category_default";
        const cp = p.custom_policy_data;
        setFormData({
          name: p.name,
          slug: p.slug,
          shortDescription: p.short_description || "",
          descriptionHtml: p.description_html || "",
          thumbnailUrl: p.thumbnail_url || "",
          basePrice: p.base_price,
          salePrice: p.sale_price?.toString() || "",
          stockQty: p.stock_qty,
          safetyStock: p.safety_stock,
          status: p.status,
          allowDeliveryDate: p.allow_delivery_date,
          categoryIds: maps.map((m) => m.category_id) || [],
          policySource,
          overrideTemplateId: p.override_template_id || "",
          primaryCategoryId,
          customDelivery: cp?.delivery_info ?? "",
          customRefund: cp?.refund_policy ?? "",
          customNotice: cp?.product_notice ?? "",
          newrunProductDraftJson: JSON.stringify(p.newrun_default_product_draft ?? {}, null, 2),
          newrunOptionDraftJson: JSON.stringify(p.newrun_default_option_draft ?? {}, null, 2),
        });
      }
      setLoading(false);
    }
    fetchProduct();
  }, [productId]);

  // 이미지 업로드
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !partnerId) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("bucket", "products");
    formDataUpload.append("partnerId", partnerId);
    formDataUpload.append("entityId", productId);

    const res = await adminFetch("/api/upload/image", {
      method: "POST",
      body: formDataUpload,
    });

    if (res.ok) {
      const data = await res.json();
      setFormData({ ...formData, thumbnailUrl: data.url });
    } else {
      alert("이미지 업로드 실패");
    }
  };

  // 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    let newrunDefaultProductDraft: Record<string, unknown> | null;
    let newrunDefaultOptionDraft: Record<string, unknown> | null;
    try {
      newrunDefaultProductDraft = parseNewrunDraftJsonField(
        formData.newrunProductDraftJson,
        "뉴런 상품 기본값"
      );
      newrunDefaultOptionDraft = parseNewrunDraftJsonField(
        formData.newrunOptionDraftJson,
        "뉴런 옵션 기본값"
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "JSON 형식 오류");
      return;
    }

    setSaving(true);

    const res = await adminFetch(`/api/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.name.trim(),
        slug: formData.slug.trim() || undefined,
        shortDescription: formData.shortDescription || null,
        descriptionHtml: formData.descriptionHtml || null,
        thumbnailUrl: formData.thumbnailUrl || null,
        basePrice: formData.basePrice,
        salePrice: formData.salePrice ? parseFloat(formData.salePrice) : null,
        stockQty: formData.stockQty,
        safetyStock: formData.safetyStock,
        status: formData.status,
        allowDeliveryDate: formData.allowDeliveryDate,
        categoryIds: formData.categoryIds,
        policySource: formData.policySource,
        overrideTemplateId:
          formData.policySource === "template"
            ? formData.overrideTemplateId || null
            : null,
        customPolicyData:
          formData.policySource === "custom"
            ? {
                delivery_info: formData.customDelivery,
                refund_policy: formData.customRefund,
                product_notice: formData.customNotice,
              }
            : null,
        primaryCategoryId:
          formData.categoryIds.length > 1 ? formData.primaryCategoryId : undefined,
        newrunDefaultProductDraft,
        newrunDefaultOptionDraft,
      }),
    });

    setSaving(false);

    if (res.ok) {
      router.push("/admin/products");
    } else {
      const data = await res.json();
      alert(data.error || "저장 실패");
    }
  };

  // 카테고리 토글
  const toggleCategory = (catId: string) => {
    setFormData((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(catId)
        ? prev.categoryIds.filter((id) => id !== catId)
        : [...prev.categoryIds, catId],
    }));
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #E5E7EB",
    borderRadius: "6px",
    fontSize: "14px",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "6px",
    fontWeight: 500,
    fontSize: "14px",
  };

  if (loading) {
    return (
      <div className="p-6 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
        <p></p>
      </div>
    );
  }

  return (
    <div
      className="p-6 [@media(min-width:768px)_and_(max-height:860px)]:p-3"
      style={{ maxWidth: "800px" }}
    >
      <AdminPageHeader
        className="!mb-4"
        eyebrow="Catalog · Products"
        title="상품 수정"
        titleIcon={Package}
        description={
          <span className="break-keep [word-break:keep-all]">
            등록된 상품의{" "}
            <strong className="font-semibold text-emerald-800">기본 정보·가격·이미지</strong>를
            바꿔{" "}
            <strong className="font-semibold text-emerald-800">수정 관리</strong>하고,{" "}
            <strong className="font-semibold text-emerald-800">가격·재고·판매 상태</strong>와
            카테고리가 쇼핑몰에 맞게 반영되는지 확인합니다.
          </span>
        }
      />

      <form onSubmit={handleSubmit}>
        <div
          style={{
            backgroundColor: "#fff",
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px" }}>
            기본 정보
          </h2>

          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={labelStyle}>상품명 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Slug (URL용)</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>간단 설명</label>
              <input
                type="text"
                value={formData.shortDescription}
                onChange={(e) =>
                  setFormData({ ...formData, shortDescription: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>상세 설명 (HTML)</label>
              <textarea
                value={formData.descriptionHtml}
                onChange={(e) =>
                  setFormData({ ...formData, descriptionHtml: e.target.value })
                }
                rows={6}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </div>
        </div>

        {/* 이미지 */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px" }}>
            대표 이미지
          </h2>

          <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            {formData.thumbnailUrl ? (
              <img
                src={formData.thumbnailUrl}
                alt="썸네일"
                style={{
                  width: "90px",
                  height: "120px",
                  objectFit: "cover",
                  objectPosition: "center",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                }}
              />
            ) : (
              <div
                style={{
                  width: "90px",
                  height: "120px",
                  backgroundColor: "#F3F4F6",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9CA3AF",
                  fontSize: "12px",
                  textAlign: "center",
                  padding: "4px",
                }}
              >
                이미지 없음
              </div>
            )}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ marginBottom: "8px" }}
              />
              <p
                style={{
                  fontSize: "12px",
                  color: "#666",
                  whiteSpace: "pre-line",
                  lineHeight: 1.55,
                  maxWidth: "420px",
                }}
              >
                {PRODUCT_IMAGE_UPLOAD_NOTICE}
              </p>
            </div>
          </div>
        </div>

        {/* 가격/재고 */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px" }}>
            가격 및 재고
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>정가 (원) *</label>
              <input
                type="number"
                value={formData.basePrice}
                onChange={(e) =>
                  setFormData({ ...formData, basePrice: parseInt(e.target.value) || 0 })
                }
                required
                min={0}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>판매가 (원)</label>
              <input
                type="number"
                value={formData.salePrice}
                onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                min={0}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>재고 수량</label>
              <input
                type="number"
                value={formData.stockQty}
                onChange={(e) =>
                  setFormData({ ...formData, stockQty: parseInt(e.target.value) || 0 })
                }
                min={0}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>안전 재고</label>
              <input
                type="number"
                value={formData.safetyStock}
                onChange={(e) =>
                  setFormData({ ...formData, safetyStock: parseInt(e.target.value) || 0 })
                }
                min={0}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* 카테고리 */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px" }}>
            카테고리
          </h2>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {categories.length === 0 ? (
              <p style={{ color: "#666", fontSize: "14px" }}>등록된 카테고리가 없습니다.</p>
            ) : (
              categories.map((cat) => (
                <label
                  key={cat.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #E5E7EB",
                    backgroundColor: formData.categoryIds.includes(cat.id)
                      ? "#EBF5FF"
                      : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.categoryIds.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  <span style={{ fontSize: "14px" }}>
                    {cat.parent_id ? "↳ " : ""}
                    {cat.name}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <ProductPolicyFormSection
          values={{
            policySource: formData.policySource,
            overrideTemplateId: formData.overrideTemplateId,
            primaryCategoryId: formData.primaryCategoryId,
            customDelivery: formData.customDelivery,
            customRefund: formData.customRefund,
            customNotice: formData.customNotice,
          }}
          onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
          categoryIds={formData.categoryIds}
          categories={categories}
          infoTemplates={infoTemplates}
          labelStyle={labelStyle}
          inputStyle={inputStyle}
        />

        {/* 상태/옵션 */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px" }}>
            판매 설정
          </h2>

          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={labelStyle}>상태</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                style={inputStyle}
              >
                <option value="draft">임시저장</option>
                <option value="active">판매중</option>
                <option value="inactive">비활성</option>
                <option value="sold_out">품절</option>
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={formData.allowDeliveryDate}
                onChange={(e) =>
                  setFormData({ ...formData, allowDeliveryDate: e.target.checked })
                }
              />
              <span style={{ fontSize: "14px" }}>희망 배송일 선택 허용</span>
            </label>
          </div>
        </div>

        {/* 뉴런 발주 기본값 T3.4 */}
        <div
          style={{
            backgroundColor: "#FAF5FF",
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #DDD6FE",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "8px" }}>
            뉴런 발주 — 상품·옵션 기본값 (선택)
          </h2>
          <p style={{ fontSize: "12px", color: "#5B21B6", marginBottom: "16px", lineHeight: 1.5 }}>
            협회 상품/옵션 검색에서 넘어오는 키·값을 JSON 객체로 넣습니다. 비우거나{" "}
            <code style={{ fontSize: "11px" }}>{`{}`}</code>만 두면 저장 시 DB에서 제거됩니다. 주문
            상세에서 검색으로 저장한 값이 있으면 그쪽이 우선합니다.
          </p>
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={labelStyle}>상품 검색 기본 payload (JSON)</label>
              <textarea
                value={formData.newrunProductDraftJson}
                onChange={(e) =>
                  setFormData({ ...formData, newrunProductDraftJson: e.target.value })
                }
                rows={5}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
              />
            </div>
            <div>
              <label style={labelStyle}>옵션 검색 기본 payload (JSON)</label>
              <textarea
                value={formData.newrunOptionDraftJson}
                onChange={(e) =>
                  setFormData({ ...formData, newrunOptionDraftJson: e.target.value })
                }
                rows={5}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
              />
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "12px 24px",
              backgroundColor: "#4A90D9",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 500,
            }}
          >
            {"저장"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: "12px 24px",
              backgroundColor: "#E5E7EB",
              color: "#333",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * T2-3: 상품 등록 페이지
 */

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
}

export default function ProductNewPage() {
  const router = useRouter();

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
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
  });

  // 파트너 정보 조회
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

  // 카테고리 목록 조회
  useEffect(() => {
    async function fetchCategories() {
      if (!partnerId) return;
      const res = await fetch(`/api/categories?partnerId=${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.flat || []);
      }
    }
    fetchCategories();
  }, [partnerId]);

  // 이미지 업로드
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !partnerId) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("bucket", "products");
    formDataUpload.append("partnerId", partnerId);
    formDataUpload.append("entityId", "temp-" + Date.now()); // 임시 ID

    const res = await fetch("/api/upload/image", {
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
    if (!partnerId || !formData.name.trim()) return;

    setSaving(true);

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId,
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

  return (
    <div style={{ padding: "24px", maxWidth: "800px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "24px" }}>
        상품 등록
      </h1>

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
              <label style={labelStyle}>Slug (URL용, 비워두면 자동생성)</label>
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
                  width: "120px",
                  height: "120px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                }}
              />
            ) : (
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  backgroundColor: "#F3F4F6",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9CA3AF",
                  fontSize: "12px",
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
              <p style={{ fontSize: "12px", color: "#666" }}>
                JPG, PNG, GIF, WebP (최대 10MB)
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
              <label style={labelStyle}>판매가 (원, 비워두면 정가로 판매)</label>
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
              <label style={labelStyle}>안전 재고 (이하 시 알림)</label>
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
            {saving ? "저장 중..." : "상품 등록"}
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

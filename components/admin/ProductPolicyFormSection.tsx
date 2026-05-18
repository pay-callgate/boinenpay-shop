"use client";

import React, { useEffect } from "react";

export type ProductPolicySourceUi = "category_default" | "template" | "custom";

export interface ProductPolicyFieldsState {
  policySource: ProductPolicySourceUi;
  overrideTemplateId: string;
  primaryCategoryId: string;
  customDelivery: string;
  customRefund: string;
  customNotice: string;
}

interface InfoTemplateOpt {
  id: string;
  name: string;
}

interface CategoryOpt {
  id: string;
  name: string;
  parent_id: string | null;
}

/** 상품 등록/수정 — PDP 탭2 정책 소스·템플릿·직접 입력 */
export function ProductPolicyFormSection({
  values,
  onChange,
  categoryIds,
  categories,
  infoTemplates,
  labelStyle,
  inputStyle,
}: {
  values: ProductPolicyFieldsState;
  onChange: (patch: Partial<ProductPolicyFieldsState>) => void;
  categoryIds: string[];
  categories: CategoryOpt[];
  infoTemplates: InfoTemplateOpt[];
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
}) {
  useEffect(() => {
    if (categoryIds.length <= 1) return;
    if (values.primaryCategoryId && categoryIds.includes(values.primaryCategoryId)) return;
    const fallback = categoryIds[0] ?? "";
    if (fallback !== values.primaryCategoryId) {
      onChange({ primaryCategoryId: fallback });
    }
    // onChange는 부모 setState 래퍼로 안정적이지 않을 수 있음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryIds, values.primaryCategoryId]);

  const taStyle = { ...inputStyle, resize: "vertical" as const, minHeight: "80px" };

  return (
    <div
      style={{
        backgroundColor: "#fff",
        padding: "24px",
        borderRadius: "8px",
        border: "1px solid #E5E7EB",
        marginBottom: "20px",
      }}
    >
      <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "8px" }}>
        배송·환불 안내 (쇼핑몰 탭)
      </h2>
      <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "16px", lineHeight: 1.5 }}>
        카테고리에 연결한 「기본 안내 템플릿」을 쓰거나, 특정 템플릿을 지정·직접 입력할 수 있습니다.
        다중 카테고리일 때는 대표 카테고리를 정하면 동일 깊이에서 우선합니다.
      </p>

      <div style={{ display: "grid", gap: "16px" }}>
        <div>
          <label style={labelStyle}>정책 소스</label>
          <select
            value={values.policySource}
            onChange={(e) =>
              onChange({
                policySource: e.target.value as ProductPolicySourceUi,
              })
            }
            style={inputStyle}
          >
            <option value="category_default">카테고리 기본 템플릿</option>
            <option value="template">지정 템플릿</option>
            <option value="custom">직접 입력</option>
          </select>
        </div>

        {values.policySource === "template" && (
          <div>
            <label style={labelStyle}>안내 템플릿</label>
            <select
              value={values.overrideTemplateId}
              onChange={(e) => onChange({ overrideTemplateId: e.target.value })}
              style={inputStyle}
            >
              <option value="">선택…</option>
              {infoTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {values.policySource === "custom" && (
          <>
            <div>
              <label style={labelStyle}>배송 안내</label>
              <textarea
                value={values.customDelivery}
                onChange={(e) => onChange({ customDelivery: e.target.value })}
                rows={4}
                style={taStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>취소·환불 안내</label>
              <textarea
                value={values.customRefund}
                onChange={(e) => onChange({ customRefund: e.target.value })}
                rows={4}
                style={taStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>상품 고시·유의사항</label>
              <textarea
                value={values.customNotice}
                onChange={(e) => onChange({ customNotice: e.target.value })}
                rows={4}
                style={taStyle}
              />
            </div>
          </>
        )}

        {categoryIds.length > 1 && values.policySource === "category_default" && (
          <div>
            <label style={labelStyle}>대표 카테고리 (템플릿 해석 보조)</label>
            <select
              value={values.primaryCategoryId}
              onChange={(e) => onChange({ primaryCategoryId: e.target.value })}
              style={inputStyle}
            >
              {categoryIds.map((cid) => {
                const c = categories.find((x) => x.id === cid);
                return (
                  <option key={cid} value={cid}>
                    {c ? `${c.parent_id ? "↳ " : ""}${c.name}` : cid}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

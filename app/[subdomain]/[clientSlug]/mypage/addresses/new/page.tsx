"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { openDaumPostcode } from "@/lib/daum-postcode";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";

/**
 * 새 배송지 추가 — 목록 페이지와 동일한 톤앤매너 (밝은 헤더, 파스텔 연보라 CTA)
 */

export default function NewAddressPage() {
  const params = useParams();
  const router = useRouter();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    postcode: "",
    address: "",
    detail: "",
    isDefault: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.address) {
      toast("배송지 정보를 모두 입력해주세요.");
      return;
    }
    if (!client?.id) {
      toast("거래처 정보를 불러올 수 없습니다.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await shopFetch(`/api/mypage/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, clientId: client.id }),
      });
      if (res.ok) {
        toast("배송지가 추가되었습니다.", "success");
        router.push(`/${subdomain}/${clientSlug}/mypage/addresses`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err?.error || "배송지 추가에 실패했습니다.", "error");
      }
    } catch {
      toast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const openPostcodeSearch = () => {
    openDaumPostcode(
      ({ zonecode, address }) => {
        setFormData((prev) => ({
          ...prev,
          postcode: zonecode,
          address,
        }));
      },
      toast
    );
  };

  const inputStyle = {
    width: "100%" as const,
    padding: "10px 12px",
    border: "1px solid #D1D5DB",
    borderRadius: "6px",
    fontSize: "0.9375rem",
    outline: "none",
  };
  const labelStyle = {
    display: "block" as const,
    fontSize: "0.875rem",
    fontWeight: 600,
    marginBottom: "6px",
    color: "#374151",
  };

  if (template == null || !partner || !client) {
    return <div style={{ minHeight: "100vh", backgroundColor: "#F5F5F5" }} />;
  }

  return (
    <OrderGuard
      partnerId={partner.id}
      shopClientId={client?.id}
      shopClientName={client?.name ?? undefined}
    >
      <div
        style={{
          maxWidth: "430px",
          margin: "0 auto",
          minHeight: "100vh",
          backgroundColor: "#F5F5F5",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "80px",
        }}
      >
        {/* 헤더 — 흰 배경, 짙은 글씨 (목록 페이지와 동일) */}
        <header
          style={{
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "#fff",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <button
            type="button"
            onClick={() => router.push(`/${subdomain}/${clientSlug}/mypage/addresses`)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, flex: 1, color: "#111" }}>
            새 배송지 추가
          </h1>
        </header>

        {/* 폼 영역 — flex: 1로 세로 긴 기기에서도 흰 배경이 끝까지 채움 */}
        <div style={{ flex: 1, backgroundColor: "#fff", padding: "20px 16px 120px", marginTop: "12px" }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>받는 분 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="이름"
                style={inputStyle}
                required
              />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>연락처 *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="010-1234-5678"
                style={inputStyle}
                required
              />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>우편번호</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  placeholder="12345"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={openPostcodeSearch}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "#fff",
                    color: "#4B5563",
                    border: "1px solid #E5E7EB",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  주소 찾기
                </button>
              </div>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>주소 *</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="서울시 강남구 테헤란로 123"
                style={inputStyle}
                required
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>상세 주소</label>
              <input
                type="text"
                value={formData.detail}
                onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                placeholder="동/호수 등"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                <span style={{ fontSize: "0.875rem", color: "#374151" }}>기본 배송지로 설정</span>
              </label>
            </div>

            {/* 메인 CTA — 연보라 풀폭 둥근 버튼 (목록의 [+ 새 배송지 추가]와 동일) */}
            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                padding: "16px",
                backgroundColor: saving ? "#D1D5DB" : "#D6A8E0",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {"저장"}
            </button>
          </form>
        </div>
      </div>
    </OrderGuard>
  );
}
